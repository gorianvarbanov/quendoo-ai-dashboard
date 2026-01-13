<template>
  <v-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" max-width="900" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon icon="mdi-calendar-clock" class="mr-2"></v-icon>
        {{ editMode ? 'Редактирай задача' : 'Създай нова задача' }}
        <v-spacer></v-spacer>
        <v-btn icon="mdi-close" variant="text" @click="close"></v-btn>
      </v-card-title>

      <v-card-text>
        <v-form ref="formRef" v-model="valid">
          <!-- Task Name -->
          <v-text-field
            v-model="formData.name"
            label="Име на задачата"
            :rules="[v => !!v || 'Името е задължително']"
            required
            prepend-inner-icon="mdi-text"
          ></v-text-field>

          <!-- Description -->
          <v-textarea
            v-model="formData.description"
            label="Описание"
            rows="2"
            prepend-inner-icon="mdi-text-box"
          ></v-textarea>

          <!-- Schedule -->
          <v-select
            v-model="formData.schedule"
            :items="schedulePresets"
            label="Разписание"
            :rules="[v => !!v || 'Разписанието е задължително']"
            required
            prepend-inner-icon="mdi-clock-outline"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props">
                <template v-slot:title>
                  <div class="d-flex justify-space-between">
                    <span>{{ item.title }}</span>
                    <span class="text-caption text-medium-emphasis">{{ item.value }}</span>
                  </div>
                </template>
              </v-list-item>
            </template>
          </v-select>

          <!-- Multi-step Actions -->
          <v-divider class="my-6"></v-divider>
          <div class="d-flex align-center mb-4">
            <h3 class="text-h6">Стъпки на задачата</h3>
            <v-spacer></v-spacer>
            <v-btn
              color="primary"
              prepend-icon="mdi-plus"
              size="small"
              @click="addStep"
            >
              Добави стъпка
            </v-btn>
          </div>

          <!-- Action Steps -->
          <v-expansion-panels v-model="expandedStep" variant="accordion">
            <v-expansion-panel
              v-for="(action, index) in formData.actions"
              :key="index"
              :value="index"
            >
              <v-expansion-panel-title>
                <div class="d-flex align-center">
                  <v-icon icon="mdi-numeric" size="small" class="mr-2"></v-icon>
                  <span class="font-weight-medium">Стъпка {{ index + 1 }}</span>
                  <span v-if="action.tool" class="ml-3 text-caption text-medium-emphasis">
                    {{ getToolLabel(action.tool) }}
                  </span>
                  <v-spacer></v-spacer>
                  <v-btn
                    v-if="formData.actions.length > 1"
                    icon="mdi-delete"
                    variant="text"
                    size="small"
                    color="error"
                    @click.stop="removeStep(index)"
                  ></v-btn>
                </div>
              </v-expansion-panel-title>

              <v-expansion-panel-text>
                <!-- Action Type -->
                <v-select
                  v-model="action.type"
                  :items="actionTypes"
                  label="Тип действие"
                  :rules="[v => !!v || 'Типът действие е задължителен']"
                  required
                  prepend-inner-icon="mdi-lightning-bolt"
                  class="mb-4"
                ></v-select>

                <!-- MCP Tool Selection -->
                <v-select
                  v-if="action.type === 'mcp_tool'"
                  v-model="action.tool"
                  :items="mcpTools"
                  label="MCP Tool"
                  :rules="[
                    v => !!v || 'Инструментът е задължителен',
                    v => mcpTools.some(t => t.value === v) || 'Невалиден инструмент'
                  ]"
                  required
                  prepend-inner-icon="mdi-tools"
                  class="mb-4"
                ></v-select>

                <!-- Tool Parameters -->
                <v-card v-if="action.type === 'mcp_tool' && action.tool" variant="tonal" class="mt-4">
                  <v-card-title class="text-subtitle-2">Параметри</v-card-title>
                  <v-card-text>
                    <!-- get_availability params -->
                    <div v-if="action.tool === 'get_availability'">
                      <v-text-field
                        v-model="action.params.date_from"
                        label="От дата (напр. {TODAY})"
                        prepend-inner-icon="mdi-calendar"
                        hint="Използвай {TODAY}, {TODAY+7}, и т.н."
                        persistent-hint
                      ></v-text-field>

                      <v-text-field
                        v-model="action.params.date_to"
                        label="До дата (напр. {TODAY+30})"
                        prepend-inner-icon="mdi-calendar"
                        class="mt-2"
                        hint="Използвай {TODAY}, {TODAY+7}, и т.н."
                        persistent-hint
                      ></v-text-field>

                      <v-select
                        v-model="action.params.sysres"
                        :items="[{ title: 'Quendoo (qdo)', value: 'qdo' }, { title: 'External (ext)', value: 'ext' }]"
                        label="System"
                        prepend-inner-icon="mdi-server"
                        class="mt-2"
                      ></v-select>
                    </div>

                    <!-- get_bookings params -->
                    <div v-else-if="action.tool === 'get_bookings'">
                      <v-alert type="info" variant="tonal">
                        Този инструмент взема всички резервации. Няма нужда от параметри.
                      </v-alert>
                    </div>

                    <!-- analyze_data params -->
                    <div v-else-if="action.tool === 'analyze_data'">
                      <v-textarea
                        v-model="action.params.data"
                        label="Данни за анализ"
                        prepend-inner-icon="mdi-database"
                        rows="3"
                        hint="Обикновено {RESULT} от предишната стъпка"
                        persistent-hint
                      ></v-textarea>

                      <v-textarea
                        v-model="action.params.instruction"
                        label="Инструкция за анализ"
                        prepend-inner-icon="mdi-text-box"
                        rows="3"
                        class="mt-2"
                        hint="Напр: 'Покажи само дните с по-малко от 5 налични стаи'"
                        persistent-hint
                      ></v-textarea>

                      <v-select
                        v-model="action.params.language"
                        :items="[
                          { title: 'Български', value: 'bulgarian' },
                          { title: 'English', value: 'english' }
                        ]"
                        label="Език на резултата"
                        prepend-inner-icon="mdi-translate"
                        class="mt-2"
                        hint="На какъв език да бъде анализът"
                        persistent-hint
                      ></v-select>

                      <v-select
                        v-model="action.params.format"
                        :items="formatOptions"
                        label="Формат на резултата"
                        prepend-inner-icon="mdi-format-text"
                        class="mt-2"
                        item-title="title"
                        item-value="value"
                      ></v-select>

                      <v-alert type="info" variant="tonal" class="mt-3">
                        <div class="text-caption">
                          <strong>Използвай {RESULT}</strong> в полето "Данни" за да анализираш резултата от предишната стъпка.
                          <br><br>
                          <strong>Примери за инструкция:</strong>
                          <ul>
                            <li>"Покажи само дните с по-малко от 5 налични стаи"</li>
                            <li>"Намери най-натовареният период"</li>
                            <li>"Изчисли средната заетост"</li>
                          </ul>
                        </div>
                      </v-alert>
                    </div>

                    <!-- send_quendoo_email params -->
                    <div v-else-if="action.tool === 'send_quendoo_email'">
                      <v-text-field
                        v-model="action.params.to"
                        label="До имейл"
                        prepend-inner-icon="mdi-email"
                        hint="Имейл адрес на получателя"
                        persistent-hint
                      ></v-text-field>

                      <v-text-field
                        v-model="action.params.subject"
                        label="Тема"
                        prepend-inner-icon="mdi-format-title"
                        class="mt-2"
                        hint="Тема на имейла"
                        persistent-hint
                      ></v-text-field>

                      <v-textarea
                        v-model="action.params.message"
                        label="Съобщение"
                        prepend-inner-icon="mdi-message-text"
                        rows="4"
                        class="mt-2"
                        hint="Използвай {RESULT} за резултата от предишната стъпка"
                        persistent-hint
                      ></v-textarea>

                      <v-checkbox
                        v-model="action.params.html"
                        label="HTML имейл"
                        hint="Отметни за изпращане на HTML форматиран имейл (за таблици и форматиране)"
                        persistent-hint
                        class="mt-2"
                      ></v-checkbox>

                      <v-alert type="info" variant="tonal" class="mt-3">
                        <div class="text-caption">
                          Можеш да използваш <code>{RESULT}</code> в съобщението за да включиш резултата от предишната стъпка.
                        </div>
                      </v-alert>
                    </div>

                    <!-- Default message -->
                    <v-alert v-else type="info" variant="tonal">
                      Параметрите за този инструмент ще бъдат добавени автоматично.
                    </v-alert>
                  </v-card-text>
                </v-card>
              </v-expansion-panel-text>
            </v-expansion-panel>
          </v-expansion-panels>

          <!-- Enabled -->
          <v-switch
            v-model="formData.enabled"
            label="Активна задача"
            color="success"
            class="mt-6"
          ></v-switch>
        </v-form>
      </v-card-text>

      <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn variant="text" @click="close">Отказ</v-btn>
        <v-btn
          color="primary"
          variant="elevated"
          :loading="loading"
          :disabled="!valid"
          @click="save"
        >
          {{ editMode ? 'Запази' : 'Създай' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  modelValue: Boolean,
  task: Object // If editing, pass existing task
})

const emit = defineEmits(['update:modelValue', 'save'])

const formRef = ref(null)
const valid = ref(false)
const loading = ref(false)
const expandedStep = ref(0)

const editMode = computed(() => !!props.task)

const formData = ref({
  name: '',
  description: '',
  schedule: '',
  actions: [
    {
      type: 'mcp_tool',
      tool: '',
      params: {}
    }
  ],
  enabled: true
})

// Schedule presets
const schedulePresets = [
  { title: 'На всеки 15 минути', value: '*/15 * * * *' },
  { title: 'На всеки час', value: '0 * * * *' },
  { title: 'Всеки ден в 9:00', value: '0 9 * * *' },
  { title: 'Всеки ден в обед (12:00)', value: '0 12 * * *' },
  { title: 'Всеки ден в полунощ', value: '0 0 * * *' },
  { title: 'Всеки понеделник в 8:00', value: '0 8 * * 1' },
  { title: 'Всяка неделя в 20:00', value: '0 20 * * 0' }
]

// Action types
const actionTypes = [
  { title: 'MCP Tool (Quendoo API)', value: 'mcp_tool' }
]

// MCP Tools
const mcpTools = [
  { title: 'Наличности (get_availability)', value: 'get_availability' },
  { title: 'Резервации (get_bookings)', value: 'get_bookings' },
  { title: 'Настройки на хотела (get_property_settings)', value: 'get_property_settings' },
  { title: 'Детайли за стаите (get_rooms_details)', value: 'get_rooms_details' },
  { title: 'Анализирай данни (analyze_data)', value: 'analyze_data' },
  { title: 'Изпрати имейл (send_quendoo_email)', value: 'send_quendoo_email' }
]

// Format options for analyze_data
const formatOptions = [
  { title: 'Текст (text)', value: 'text' },
  { title: 'JSON (json)', value: 'json' },
  { title: 'Таблица - Markdown (table)', value: 'table' },
  { title: 'Таблица - HTML за имейл (html_table)', value: 'html_table' },
  { title: 'Списък (list)', value: 'list' }
]

function getToolLabel(toolName) {
  const tool = mcpTools.find(t => t.value === toolName)
  return tool ? tool.title : toolName
}

function addStep() {
  const newAction = {
    type: 'mcp_tool',
    tool: '',
    params: {}
  }
  formData.value.actions.push(newAction)
  expandedStep.value = formData.value.actions.length - 1
}

function removeStep(index) {
  formData.value.actions.splice(index, 1)
  if (expandedStep.value >= formData.value.actions.length) {
    expandedStep.value = formData.value.actions.length - 1
  }
}

// Watch for task prop changes (when editing)
watch(() => props.task, (newTask) => {
  console.log('[TaskForm] ===== WATCH TRIGGERED =====')
  console.log('[TaskForm] Task:', newTask ? 'EXISTS' : 'NULL')
  console.log('[TaskForm] Task ID:', newTask?.id)
  console.log('[TaskForm] Task name:', newTask?.name)

  if (newTask) {
    console.log('[TaskForm] Loading task for editing:', JSON.stringify(newTask, null, 2))

    // Deep clone actions to ensure proper reactivity
    const clonedActions = newTask.actions
      ? JSON.parse(JSON.stringify(newTask.actions))
      : (newTask.action ? [JSON.parse(JSON.stringify(newTask.action))] : [{
          type: 'mcp_tool',
          tool: '',
          params: {}
        }])

    // Only add default values if completely missing (not just falsy)
    clonedActions.forEach((action, idx) => {
      if (action.tool === 'analyze_data' && action.params) {
        console.log(`[TaskForm] Action ${idx} before defaults:`, JSON.stringify(action.params, null, 2))

        // Only set if property doesn't exist at all
        if (!('language' in action.params)) {
          console.log(`[TaskForm] Adding default language`)
          action.params.language = 'bulgarian'
        } else {
          console.log(`[TaskForm] Keeping existing language: "${action.params.language}"`)
        }

        if (!('format' in action.params)) {
          console.log(`[TaskForm] Adding default format`)
          action.params.format = 'text'
        } else {
          console.log(`[TaskForm] Keeping existing format: "${action.params.format}"`)
        }

        console.log(`[TaskForm] Action ${idx} after defaults:`, JSON.stringify(action.params, null, 2))
      }
    })

    formData.value = {
      name: newTask.name || '',
      description: newTask.description || '',
      schedule: newTask.schedule || '',
      actions: clonedActions,
      enabled: newTask.enabled !== undefined ? newTask.enabled : true
    }

    console.log('[TaskForm] Final formData.actions:', JSON.stringify(formData.value.actions, null, 2))
  }
}, { immediate: true })

// Watch action.tool changes to set default params
watch(() => formData.value.actions.map(a => a.tool), (newTools, oldTools) => {
  formData.value.actions.forEach((action, index) => {
    const oldTool = oldTools ? oldTools[index] : null
    const newTool = newTools[index]

    // Only set defaults when tool changes AND params are empty/undefined
    // This prevents overwriting existing params when loading task for editing
    if (newTool && newTool !== oldTool) {
      console.log(`[TaskForm] Tool changed from "${oldTool}" to "${newTool}" at index ${index}`)
      console.log(`[TaskForm] Existing params:`, action.params)

      // Check if params already exist and have data
      const hasExistingParams = action.params && Object.keys(action.params).length > 0

      // Only set defaults if params are empty
      // Don't set defaults when loading existing task data (even if oldTool is null)
      if (!hasExistingParams) {
        console.log(`[TaskForm] Setting default params for ${newTool}`)

        if (newTool === 'get_availability') {
          action.params = {
            date_from: '{TODAY}',
            date_to: '{TODAY+7}',
            sysres: 'qdo'
          }
        } else if (newTool === 'analyze_data') {
          action.params = {
            data: '{RESULT}',
            instruction: 'Покажи само дните с по-малко от 5 налични стаи',
            language: 'bulgarian',
            format: 'text'
          }
        } else if (newTool === 'send_quendoo_email') {
          action.params = {
            to: '',
            subject: 'Резултат от задача: {TASK_NAME}',
            message: 'Резултат от изпълнение на задача {TASK_NAME}:\n\n{RESULT}',
            html: false  // Default to plain text
          }
        } else {
          action.params = {}
        }
      } else {
        console.log(`[TaskForm] Keeping existing params (not overwriting)`)
      }
    }
  })
})

function close() {
  emit('update:modelValue', false)
  resetForm()
}

function resetForm() {
  formData.value = {
    name: '',
    description: '',
    schedule: '',
    actions: [
      {
        type: 'mcp_tool',
        tool: '',
        params: {}
      }
    ],
    enabled: true
  }
  formRef.value?.reset()
}

async function save() {
  const { valid: isValid } = await formRef.value.validate()
  if (!isValid) return

  loading.value = true

  try {
    // Log raw actions for debugging
    console.log('[TaskForm] Raw actions:', JSON.stringify(formData.value.actions, null, 2))

    // Filter out empty/invalid actions (those without type or tool)
    const validActions = formData.value.actions.filter(action => {
      const isValid = action.type && action.tool
      console.log(`[TaskForm] Action valid=${isValid}:`, action)
      return isValid
    })

    console.log('[TaskForm] Valid actions count:', validActions.length)
    console.log('[TaskForm] Valid actions:', JSON.stringify(validActions, null, 2))

    if (validActions.length === 0) {
      console.error('[TaskForm] No valid actions to save!')
      return
    }

    // Deep clone to convert Vue Proxy objects to plain objects
    // This fixes serialization issues when sending to backend
    const plainActions = JSON.parse(JSON.stringify(validActions))

    console.log('[TaskForm] Plain actions (after deep clone):', JSON.stringify(plainActions, null, 2))

    // Backend extracts hotelId from JWT token, no need to send it
    const taskData = {
      name: formData.value.name,
      description: formData.value.description,
      schedule: formData.value.schedule,
      enabled: formData.value.enabled,
      actions: plainActions
    }

    console.log('[TaskForm] Final taskData being sent:', JSON.stringify(taskData, null, 2))

    emit('save', taskData, props.task?.id)
    close()
  } catch (error) {
    console.error('[TaskForm] Error saving:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.v-card-title {
  background: rgba(var(--v-theme-primary), 0.08);
}

code {
  background: rgba(0, 0, 0, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Courier New', monospace;
}
</style>
