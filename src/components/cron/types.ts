export interface Job {
  id: number
  name: string
  description: string
  trigger_type: 'cron' | 'interval' | 'date' | 'manual'
  expression: string
  command: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export interface JobLog {
  id: number
  job_id: number
  job_name: string
  started_at: string
  finished_at: string | null
  status: 'running' | 'success' | 'failed'
  exit_code: number | null
  stdout: string
  stderr: string
}
