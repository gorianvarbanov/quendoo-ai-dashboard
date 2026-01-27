/**
 * Analytics Agent
 * Handles data analysis, reporting, and insights
 */

import Anthropic from '@anthropic-ai/sdk'
import { BaseAgent } from './BaseAgent.js'
import admin from 'firebase-admin'

export class AnalyticsAgent extends BaseAgent {
  constructor() {
    super('Analytics', 'claude-haiku-3-5-20241022') // Use Haiku for cost efficiency

    this.capabilities = [
      'analytics',
      'reporting',
      'forecasting',
      'data_analysis'
    ]

    this.permissions = {
      read: ['bookings', 'rates', 'revenue', 'occupancy', 'analytics'],
      write: ['analytics', 'reports'],
      delete: []
    }

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })

    this.db = admin.firestore()
  }

  /**
   * Execute analytics task
   */
  async execute({ message, intent, context }) {
    try {
      this.log('INFO', 'Executing analytics task', { message })

      // Determine specific analytics task
      const taskType = await this.determineTaskType(message)
      this.log('INFO', 'Task type determined', { taskType })

      // Fetch required data
      const data = await this.fetchData(taskType, context)
      this.log('INFO', 'Data fetched', { dataSize: JSON.stringify(data).length })

      // Analyze data using Claude
      const analysis = await this.analyzeData(data, message, context)

      return {
        agent: this.name,
        taskType,
        data,
        analysis,
        success: true
      }

    } catch (error) {
      this.log('ERROR', 'Analytics execution failed', { error: error.message })
      return {
        agent: this.name,
        error: error.message,
        success: false
      }
    }
  }

  /**
   * Determine specific analytics task type
   */
  async determineTaskType(message) {
    const lowerMessage = message.toLowerCase()

    if (lowerMessage.includes('revenue') || lowerMessage.includes('приход')) {
      return 'revenue_analysis'
    } else if (lowerMessage.includes('occupancy') || lowerMessage.includes('заетост')) {
      return 'occupancy_analysis'
    } else if (lowerMessage.includes('booking') || lowerMessage.includes('резервац')) {
      return 'booking_analysis'
    } else if (lowerMessage.includes('forecast') || lowerMessage.includes('прогноз')) {
      return 'forecast'
    } else if (lowerMessage.includes('trend') || lowerMessage.includes('тенденц')) {
      return 'trend_analysis'
    } else {
      return 'general_analysis'
    }
  }

  /**
   * Fetch data from Firestore based on task type
   */
  async fetchData(taskType, context) {
    const { hotelId } = context
    const data = {}

    try {
      switch (taskType) {
        case 'revenue_analysis':
          data.bookings = await this.fetchBookings(hotelId, 30) // Last 30 days
          data.revenue = this.calculateRevenue(data.bookings)
          break

        case 'occupancy_analysis':
          data.bookings = await this.fetchBookings(hotelId, 30)
          data.rooms = await this.fetchRooms(hotelId)
          data.occupancy = this.calculateOccupancy(data.bookings, data.rooms)
          break

        case 'booking_analysis':
          data.bookings = await this.fetchBookings(hotelId, 90) // Last 90 days
          data.channels = this.analyzeChannels(data.bookings)
          break

        case 'forecast':
          data.historical = await this.fetchBookings(hotelId, 180) // 6 months
          data.trends = this.identifyTrends(data.historical)
          break

        default:
          data.bookings = await this.fetchBookings(hotelId, 30)
          data.rooms = await this.fetchRooms(hotelId)
      }

      return data

    } catch (error) {
      this.log('ERROR', 'Data fetch failed', { error: error.message })
      throw error
    }
  }

  /**
   * Fetch bookings from Firestore
   */
  async fetchBookings(hotelId, daysBack) {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    const snapshot = await this.db
      .collection('bookings')
      .where('hotelId', '==', hotelId)
      .where('checkIn', '>=', admin.firestore.Timestamp.fromDate(cutoffDate))
      .orderBy('checkIn', 'desc')
      .limit(1000)
      .get()

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  }

  /**
   * Fetch rooms from Firestore
   */
  async fetchRooms(hotelId) {
    const snapshot = await this.db
      .collection('hotels')
      .doc(hotelId)
      .collection('rooms')
      .get()

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
  }

  /**
   * Calculate revenue from bookings
   */
  calculateRevenue(bookings) {
    const revenueByDay = {}
    let totalRevenue = 0

    bookings.forEach(booking => {
      const date = booking.checkIn.toDate().toISOString().split('T')[0]
      const revenue = booking.totalPrice || 0

      revenueByDay[date] = (revenueByDay[date] || 0) + revenue
      totalRevenue += revenue
    })

    return {
      total: totalRevenue,
      byDay: revenueByDay,
      average: totalRevenue / Object.keys(revenueByDay).length,
      bookingCount: bookings.length
    }
  }

  /**
   * Calculate occupancy rates
   */
  calculateOccupancy(bookings, rooms) {
    const totalRooms = rooms.length
    const occupancyByDay = {}

    bookings.forEach(booking => {
      const checkIn = booking.checkIn.toDate()
      const checkOut = booking.checkOut.toDate()
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))

      for (let i = 0; i < nights; i++) {
        const date = new Date(checkIn)
        date.setDate(date.getDate() + i)
        const dateStr = date.toISOString().split('T')[0]

        occupancyByDay[dateStr] = (occupancyByDay[dateStr] || 0) + 1
      }
    })

    // Calculate percentages
    const occupancyPercentages = {}
    let totalOccupancy = 0

    Object.entries(occupancyByDay).forEach(([date, bookedRooms]) => {
      const percentage = (bookedRooms / totalRooms) * 100
      occupancyPercentages[date] = percentage
      totalOccupancy += percentage
    })

    return {
      byDay: occupancyPercentages,
      average: totalOccupancy / Object.keys(occupancyPercentages).length,
      totalRooms
    }
  }

  /**
   * Analyze booking channels
   */
  analyzeChannels(bookings) {
    const channelStats = {}

    bookings.forEach(booking => {
      const channel = booking.channel || 'direct'

      if (!channelStats[channel]) {
        channelStats[channel] = {
          count: 0,
          revenue: 0
        }
      }

      channelStats[channel].count++
      channelStats[channel].revenue += booking.totalPrice || 0
    })

    return channelStats
  }

  /**
   * Identify trends in historical data
   */
  identifyTrends(bookings) {
    // Group by month
    const monthlyStats = {}

    bookings.forEach(booking => {
      const month = booking.checkIn.toDate().toISOString().substring(0, 7) // YYYY-MM

      if (!monthlyStats[month]) {
        monthlyStats[month] = {
          bookings: 0,
          revenue: 0
        }
      }

      monthlyStats[month].bookings++
      monthlyStats[month].revenue += booking.totalPrice || 0
    })

    // Calculate growth rates
    const months = Object.keys(monthlyStats).sort()
    const trends = []

    for (let i = 1; i < months.length; i++) {
      const prevMonth = monthlyStats[months[i - 1]]
      const currentMonth = monthlyStats[months[i]]

      const bookingGrowth = ((currentMonth.bookings - prevMonth.bookings) / prevMonth.bookings) * 100
      const revenueGrowth = ((currentMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100

      trends.push({
        month: months[i],
        bookingGrowth,
        revenueGrowth
      })
    }

    return {
      monthlyStats,
      trends
    }
  }

  /**
   * Analyze data using Claude
   */
  async analyzeData(data, originalMessage, context) {
    const systemPrompt = `You are an analytics expert for hotel management.

Analyze the provided data and give insights, trends, and recommendations.

Respond in ${context.language}.

Guidelines:
- Be specific with numbers and percentages
- Identify positive and negative trends
- Provide actionable recommendations
- Use clear, professional language
- Format with markdown for readability`

    const dataStr = JSON.stringify(data, null, 2)

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `User question: "${originalMessage}"\n\nData:\n${dataStr}\n\nProvide analysis and insights.`
        }
      ]
    })

    return response.content[0].text
  }
}
