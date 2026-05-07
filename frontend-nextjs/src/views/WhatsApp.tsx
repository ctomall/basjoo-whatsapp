'use client'

import { useState, useEffect, useCallback } from 'react'

interface WhatsAppStatus {
  connected: boolean
  phone: string | null
  has_session: boolean
  bridge_running?: boolean
}

const API_BASE = ''

function formatPhone(raw: string | null): string {
  if (!raw) return ''
  // 8613616353377:37@s.whatsapp.net → +86 13616353377
  const match = raw.match(/^(\d+)(?::\d+)?@/)
  if (!match) return raw
  const num = match[1]
  if (num.startsWith('86') && num.length === 13) {
    return `+86 ${num.slice(2, 5)} ${num.slice(5, 9)} ${num.slice(9)}`
  }
  return `+${num}`
}

export default function WhatsAppView() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/whatsapp/status`)
      if (!res.ok) throw new Error('Status fetch failed')
      const data = await res.json()
      setStatus(data)
      setError(null)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchQr = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${API_BASE}/api/v1/whatsapp/qr`)
      if (!res.ok) {
        const text = await res.text()
        try {
          const err = JSON.parse(text)
          throw new Error(err.error || err.detail || 'QR unavailable')
        } catch {
          throw new Error('QR code not available')
        }
      }
      const blob = await res.blob()
      setQrUrl(URL.createObjectURL(blob))
    } catch (e: any) {
      setError(e.message)
      setQrUrl(null)
    }
  }, [])

  const handleDisconnect = useCallback(async () => {
    if (!confirm('确定要断开当前 WhatsApp 连接吗？断开后需要重新扫码配对。')) return
    setDisconnecting(true)
    try {
      const res = await fetch(`${API_BASE}/api/v1/whatsapp/logout`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Logout failed')
      }
      setStatus({ connected: false, phone: null, has_session: false, bridge_running: true })
      setQrUrl(null)
      setError(null)
      // Auto-fetch QR after disconnect
      setTimeout(() => fetchQr(), 1500)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setDisconnecting(false)
    }
  }, [fetchQr])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    if (status && !status.connected && !qrUrl && !disconnecting) {
      const timer = setTimeout(() => fetchQr(), 500)
      return () => clearTimeout(timer)
    }
  }, [status, qrUrl, fetchQr, disconnecting])

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        Loading...
      </div>
    )
  }

  const borderColor = status?.connected ? '#22c55e'
    : status?.bridge_running === false ? '#ef4444'
    : '#e5e7eb'

  const dotColor = status?.connected ? '#22c55e'
    : status?.bridge_running === false ? '#ef4444'
    : '#f59e0b'

  const statusText = status?.connected ? '已连接'
    : status?.bridge_running === false ? '桥接未运行'
    : '等待扫码'

  return (
    <div style={{ padding: '1.5rem', maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
          WhatsApp 管理
        </h2>
        {status?.connected && (
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            style={{
              padding: '0.4rem 1rem',
              background: '#fff',
              color: '#ef4444',
              border: '1px solid #ef4444',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            {disconnecting ? '断开中...' : '断开连接'}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem',
          borderRadius: 8, marginBottom: '1rem', fontSize: '0.9rem',
        }}>
          {error}
        </div>
      )}

      {/* Status Card */}
      <div style={{
        background: '#fff', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: `2px solid ${borderColor}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: dotColor, display: 'inline-block' }} />
          <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{statusText}</span>
        </div>

        {status?.connected && status?.phone && (
          <div style={{ color: '#374151', fontSize: '0.95rem', marginBottom: '0.5rem' }}>
            📱 <strong>{formatPhone(status.phone)}</strong>
          </div>
        )}

        {status?.connected && (
          <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            会话状态: {status.has_session ? '已保存' : '未保存'}
          </div>
        )}

        {status && !status.connected && status.bridge_running === false && (
          <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>
            ⚠️ WhatsApp 桥接服务未运行，请启动 bridge.js
          </div>
        )}

        {status && !status.connected && status.bridge_running !== false && (
          <div style={{ color: '#f59e0b', fontSize: '0.9rem' }}>
            ⏳ 等待扫码配对...
          </div>
        )}
      </div>

      {/* QR Code — shown when not connected or clicking "add number" */}
      {!status?.connected && (
        <div style={{
          background: '#fff', borderRadius: 12, padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', fontWeight: 600 }}>
            📲 添加 WhatsApp 号码
          </h3>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
            用手机 WhatsApp 扫描下方二维码即可完成绑定
          </p>
          {qrUrl ? (
            <div style={{ textAlign: 'center' }}>
              <img
                src={qrUrl}
                alt="WhatsApp QR Code"
                style={{ width: 280, height: 280, border: '1px solid #e5e7eb', borderRadius: 8 }}
              />
              <p style={{ marginTop: '0.75rem', color: '#6b7280', fontSize: '0.85rem' }}>
                WhatsApp → 设置 → 关联设备 → 扫码
              </p>
              <button
                onClick={fetchQr}
                style={{
                  marginTop: '0.5rem', padding: '0.25rem 0.75rem',
                  background: 'transparent', color: '#6b7280',
                  border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem',
                }}
              >
                刷新二维码
              </button>
            </div>
          ) : (
            <button
              onClick={fetchQr}
              style={{
                padding: '0.75rem 2rem', background: '#25D366', color: '#fff',
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '1rem', fontWeight: 600,
              }}
            >
              获取 QR 码
            </button>
          )}
        </div>
      )}
    </div>
  )
}
