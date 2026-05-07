'use client'

import dynamic from 'next/dynamic'

const WhatsAppView = dynamic(() => import('@/src/views/WhatsApp'), { ssr: false })

export default function WhatsAppPage() {
  return <WhatsAppView />
}
