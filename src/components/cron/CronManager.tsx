'use client'

import { useState, useEffect, type SubmitEvent } from 'react'
import type { Job, JobLog } from './types'

const API_BASE = '/api/cron'

export default function CronManager() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [logs, setLogs] = useState<JobLog[]>([])
  const [selectedJob, setSelectedJob] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Job>>({
    name: '',
    description: '',
    trigger_type: 'cron',
    expression: '0 9 * * *',
    command: '',
    enabled: true,
  })
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    loadJobs()
    loadLogs()
    const id = setInterval(loadLogs, 3000)
    return () => clearInterval(id)
  }, [selectedJob])

  async function loadJobs() {
    const res = await fetch(`${API_BASE}/jobs`)
    setJobs(await res.json())
  }

  async function loadLogs() {
    const url = selectedJob ? `${API_BASE}/logs/job/${selectedJob}` : `${API_BASE}/logs`
    const res = await fetch(url)
    const data = await res.json()
    setLogs(data.items || [])
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault()
    const method = editingId ? 'PUT' : 'POST'
    const url = editingId ? `${API_BASE}/jobs/${editingId}` : `${API_BASE}/jobs`
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      setForm({ name: '', description: '', trigger_type: 'cron', expression: '0 9 * * *', command: '', enabled: true })
      setEditingId(null)
      await loadJobs()
    }
  }

  async function deleteJob(id: number) {
    if (!confirm('确认删除？')) return
    await fetch(`${API_BASE}/jobs/${id}`, { method: 'DELETE' })
    await loadJobs()
  }

  async function toggleJob(id: number) {
    await fetch(`${API_BASE}/jobs/${id}/toggle`, { method: 'POST' })
    await loadJobs()
  }

  async function runJob(id: number) {
    await fetch(`${API_BASE}/jobs/${id}/run`, { method: 'POST' })
    setTimeout(loadLogs, 1000)
  }

  function editJob(job: Job) {
    setForm(job)
    setEditingId(job.id)
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-lg border border-gray-200 p-4 sm:p-6 lg:p-8 dark:border-gray-700">
        <h2 className="mb-4 text-lg font-semibold sm:text-xl lg:text-2xl">{editingId ? '编辑任务' : '新建任务'}</h2>
        <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6">
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium md:text-base">名称</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800 md:text-sm"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium md:text-base">触发类型</label>
            <select
              className="w-full rounded border border-gray-300 px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800 md:text-sm"
              value={form.trigger_type}
              onChange={(e) => setForm({ ...form, trigger_type: e.target.value as Job['trigger_type'] })}
            >
              <option value="cron">Cron 表达式</option>
              <option value="interval">间隔（秒）</option>
              <option value="date">指定时间</option>
              <option value="manual">手动</option>
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium md:text-base">
              {form.trigger_type === 'cron' ? 'Cron 表达式' : form.trigger_type === 'interval' ? '间隔秒数' : 'ISO 时间'}
            </label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800 md:text-sm"
              value={form.expression}
              onChange={(e) => setForm({ ...form, expression: e.target.value })}
              required={form.trigger_type !== 'manual'}
              placeholder={form.trigger_type === 'cron' ? '0 9 * * *' : form.trigger_type === 'interval' ? '60' : '2026-01-01T09:00:00'}
            />
          </div>
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium md:text-base">状态</label>
            <select
              className="w-full rounded border border-gray-300 px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800 md:text-sm"
              value={form.enabled ? 'true' : 'false'}
              onChange={(e) => setForm({ ...form, enabled: e.target.value === 'true' })}
            >
              <option value="true">启用</option>
              <option value="false">禁用</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium md:text-base">描述</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-base dark:border-gray-600 dark:bg-gray-800 md:text-sm"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium md:text-base">执行命令</label>
            <textarea
              className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 md:text-xs"
              rows={3}
              value={form.command}
              onChange={(e) => setForm({ ...form, command: e.target.value })}
              required
              placeholder="bash /Users/hh/.hermes/scripts/restart_hermes_gateway.sh"
            />
          </div>
          <div className="flex flex-wrap gap-3 md:col-span-2">
            <button
              type="submit"
              className="rounded bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 md:px-4 md:py-2 md:text-base"
            >
              {editingId ? '保存' : '创建'}
            </button>
            {editingId && (
              <button
                type="button"
                className="rounded border border-gray-300 px-5 py-2.5 text-sm font-medium hover:bg-gray-100 dark:border-gray-600 dark:hover:bg-gray-700 md:px-4 md:py-2 md:text-base"
                onClick={() => { setEditingId(null); setForm({ name: '', description: '', trigger_type: 'cron', expression: '0 9 * * *', command: '', enabled: true }) }}
              >
                取消
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-gray-200 p-4 sm:p-6 lg:p-8 dark:border-gray-700">
        <h2 className="mb-4 text-lg font-semibold sm:text-xl lg:text-2xl">任务列表</h2>

        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm md:text-base">
              <thead className="border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-2 py-2">名称</th>
                  <th className="px-2 py-2">触发器</th>
                  <th className="px-2 py-2">状态</th>
                  <th className="px-2 py-2">命令</th>
                  <th className="px-2 py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="px-2 py-2 font-medium">{job.name}</td>
                    <td className="px-2 py-2">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{job.trigger_type}</span>
                      <div className="text-xs text-gray-500">{job.expression}</div>
                    </td>
                    <td className="px-2 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs ${job.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800'}`}>
                        {job.enabled ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-2 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">{job.command}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => runJob(job.id)} className="mr-2 rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700">执行</button>
                      <button onClick={() => toggleJob(job.id)} className="mr-2 rounded bg-yellow-500 px-2 py-1 text-xs text-white hover:bg-yellow-600">{job.enabled ? '停用' : '启用'}</button>
                      <button onClick={() => editJob(job)} className="mr-2 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">编辑</button>
                      <button onClick={() => setSelectedJob(job.id === selectedJob ? null : job.id)} className="mr-2 rounded bg-gray-600 px-2 py-1 text-xs text-white hover:bg-gray-700">日志</button>
                      <button onClick={() => deleteJob(job.id)} className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700">删除</button>
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && <tr><td colSpan={5} className="py-4 text-center text-gray-500">暂无任务</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="md:hidden">
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-base font-semibold">{job.name}</h3>
                  <span className={`shrink-0 rounded px-2 py-0.5 text-xs ${job.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800'}`}>
                    {job.enabled ? '启用' : '禁用'}
                  </span>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{job.trigger_type}</span>
                  <span>{job.expression}</span>
                </div>
                <div className="mb-3 truncate font-mono text-xs text-gray-600 dark:text-gray-400">{job.command}</div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                  <button onClick={() => runJob(job.id)} className="rounded bg-green-600 px-2 py-2 text-xs text-white hover:bg-green-700 sm:text-sm">执行</button>
                  <button onClick={() => toggleJob(job.id)} className="rounded bg-yellow-500 px-2 py-2 text-xs text-white hover:bg-yellow-600 sm:text-sm">{job.enabled ? '停用' : '启用'}</button>
                  <button onClick={() => editJob(job)} className="rounded bg-blue-600 px-2 py-2 text-xs text-white hover:bg-blue-700 sm:text-sm">编辑</button>
                  <button onClick={() => setSelectedJob(job.id === selectedJob ? null : job.id)} className="rounded bg-gray-600 px-2 py-2 text-xs text-white hover:bg-gray-700 sm:text-sm">日志</button>
                  <button onClick={() => deleteJob(job.id)} className="rounded bg-red-600 px-2 py-2 text-xs text-white hover:bg-red-700 sm:text-sm">删除</button>
                </div>
              </div>
            ))}
            {jobs.length === 0 && <div className="py-4 text-center text-gray-500">暂无任务</div>}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 p-4 sm:p-6 lg:p-8 dark:border-gray-700">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold sm:text-xl lg:text-2xl">执行日志</h2>
          <button onClick={() => setSelectedJob(null)} className="text-sm text-blue-600 hover:underline md:text-base">
            {selectedJob ? '查看全部' : ''}
          </button>
        </div>
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700 sm:p-4 sm:text-base">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{log.job_name}</span>
                <span className={`rounded px-2 py-0.5 text-xs sm:text-sm ${log.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : log.status === 'running' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'}`}>
                  {log.status}
                </span>
              </div>
              <div className="mb-2 text-xs text-gray-500 sm:text-sm">{new Date(log.started_at).toLocaleString()} {log.exit_code !== null && `· exit ${log.exit_code}`}</div>
              {log.stdout && <pre className="mb-1 max-h-32 overflow-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800 sm:text-sm">{log.stdout}</pre>}
              {log.stderr && <pre className="max-h-32 overflow-auto rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300 sm:text-sm">{log.stderr}</pre>}
            </div>
          ))}
          {logs.length === 0 && <div className="text-center text-gray-500">暂无日志</div>}
        </div>
      </section>
    </div>
  )
}
