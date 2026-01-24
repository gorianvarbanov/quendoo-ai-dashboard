import { jsPDF } from 'jspdf'

/**
 * Export conversation to Markdown format
 */
export function exportToMarkdown(conversation, messages) {
  const title = conversation.title || 'Conversation'
  const createdAt = new Date(conversation.createdAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  let markdown = `# ${title}\n\n`
  markdown += `**Created:** ${createdAt}\n\n`
  markdown += `---\n\n`

  messages.forEach((msg, index) => {
    const role = msg.role === 'user' ? 'You' : 'Quendoo AI'
    const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })

    markdown += `### ${role} (${timestamp})\n\n`
    markdown += `${msg.content}\n\n`

    // Add tools used if present
    if (msg.toolsUsed && msg.toolsUsed.length > 0) {
      markdown += `**Tools used:** ${msg.toolsUsed.map(t => t.name).join(', ')}\n\n`
    }

    markdown += `---\n\n`
  })

  // Create download
  const blob = new Blob([markdown], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(title)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export conversation to JSON format
 */
export function exportToJSON(conversation, messages) {
  const exportData = {
    conversation: {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    },
    messages: messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      toolsUsed: msg.toolsUsed || [],
      metadata: msg.metadata || {}
    })),
    exportedAt: new Date().toISOString(),
    version: '1.0'
  }

  const json = JSON.stringify(exportData, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(conversation.title)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export conversation to PDF format
 */
export function exportToPDF(conversation, messages) {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 20
  const maxWidth = pageWidth - 2 * margin
  let currentY = margin

  // Helper to check if we need a new page
  const checkNewPage = (requiredHeight = 40) => {
    if (currentY + requiredHeight > pageHeight - margin) {
      doc.addPage()
      currentY = margin
      return true
    }
    return false
  }

  // Title
  doc.setFontSize(18)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text(conversation.title || 'Conversation', margin, currentY)
  currentY += 10

  // Date
  doc.setFontSize(10)
  doc.setFont(undefined, 'normal')
  doc.setTextColor(100, 100, 100)
  const createdDate = new Date(conversation.createdAt).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
  doc.text(`Created: ${createdDate}`, margin, currentY)
  currentY += 15

  // Messages
  messages.forEach((msg, index) => {
    checkNewPage(50)

    // Message header
    doc.setFontSize(12)
    doc.setFont(undefined, 'bold')
    if (msg.role === 'user') {
      doc.setTextColor(25, 118, 210) // Blue for user
    } else {
      doc.setTextColor(76, 175, 80) // Green for assistant
    }

    const role = msg.role === 'user' ? 'You' : 'Quendoo AI'
    const timestamp = new Date(msg.timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
    doc.text(`${role} (${timestamp})`, margin, currentY)
    currentY += 8

    // Message content
    doc.setFontSize(10)
    doc.setFont(undefined, 'normal')
    doc.setTextColor(0, 0, 0)

    // Split text into lines that fit the page width
    const lines = doc.splitTextToSize(msg.content, maxWidth)
    lines.forEach(line => {
      checkNewPage(10)
      doc.text(line, margin, currentY)
      currentY += 6
    })

    // Tools used
    if (msg.toolsUsed && msg.toolsUsed.length > 0) {
      checkNewPage(10)
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(`Tools: ${msg.toolsUsed.map(t => t.name).join(', ')}`, margin, currentY)
      currentY += 6
    }

    currentY += 10 // Space between messages
  })

  // Add footer with page numbers
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Save PDF
  doc.save(`${sanitizeFilename(conversation.title)}.pdf`)
}

/**
 * Sanitize filename for download
 */
function sanitizeFilename(filename) {
  return filename
    .replace(/[^a-z0-9]/gi, '_')
    .replace(/_+/g, '_')
    .toLowerCase()
    .substring(0, 50)
}
