import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'V2 Test - WC 2026',
  description: 'Simple test page',
}

export default async function BracketV2TestPage() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wc/bracket/v2-test')
  }

  return (
    <div className="min-h-screen bg-ps-bg px-4 py-8">
      <div className="mx-auto max-w-[480px]">
        <header className="mb-6">
          <h1 className="font-display text-2xl font-extrabold text-ps-text">
            V2 Test Page
          </h1>
          <p className="mt-1 text-sm text-ps-text-sec">
            User: {user.email}
          </p>
          <p className="mt-1 text-sm text-ps-text-sec">
            This page loaded successfully!
          </p>
        </header>
      </div>
    </div>
  )
}
