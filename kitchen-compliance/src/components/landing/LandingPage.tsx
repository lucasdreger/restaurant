import { useState } from 'react'
import { 
  Shield, Thermometer, Clock, CheckCircle, ArrowRight, 
  Mic, ChefHat, AlertTriangle, Sparkles,
  FileCheck, BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SignUpModal } from './SignUpModal'
import { SignInModal } from './SignInModal'

interface LandingPageProps {
  onSignIn?: () => void
  onDemoStart?: () => void
}

export function LandingPage({ onSignIn: _onSignIn, onDemoStart }: LandingPageProps) {
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [selectedTier, setSelectedTier] = useState<'tier1' | 'tier2' | 'tier3'>('tier2')

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-lg border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <ChefHat className="w-6 h-6 text-white" />
              </div>
              <span className="text-xl font-bold">ChefCompliance</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsSignInOpen(true)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white transition-colors"
              >
                Sign In
              </button>
              <button 
                onClick={() => setIsSignUpOpen(true)}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl font-semibold text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
              >
                Start Free Trial
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[100px]" />
          <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-cyan-500/20 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-emerald-500/10 to-transparent rounded-full" />
        </div>

        <div className="max-w-5xl mx-auto text-center relative z-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            FSAI Compliant • HACCP Ready
          </div>

          {/* Main Headline */}
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-emerald-100 to-cyan-100">
              Stop Failing
            </span>
            <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              Health Inspections
            </span>
          </h1>

          {/* Sub-headline */}
          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Voice-powered food safety compliance that 
            <span className="text-emerald-400 font-semibold"> saves 2+ hours daily</span> on paperwork 
            and keeps you <span className="text-cyan-400 font-semibold">100% inspection-ready</span>.
          </p>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-10 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">30-Day Free Trial</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Easy Setup</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-slate-300">Setup in 5 Minutes</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <button 
              onClick={() => setIsSignUpOpen(true)}
              className="group px-8 py-4 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl font-bold text-lg hover:shadow-2xl hover:shadow-emerald-500/30 transition-all flex items-center gap-3 hover:scale-105"
            >
              Start Your Free Trial
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={onDemoStart}
              className="px-8 py-4 bg-amber-500/20 border border-amber-500/50 rounded-2xl font-semibold text-lg hover:bg-amber-500/30 transition-all text-amber-400"
            >
              🍳 Try Demo
            </button>
            <button 
              onClick={() => setIsSignInOpen(true)}
              className="px-8 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl font-semibold text-lg hover:bg-slate-800 transition-all"
            >
              Sign In
            </button>
          </div>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-8 text-slate-400">
            <div className="text-center">
              <div className="text-3xl font-bold text-white">Early Access</div>
              <div className="text-sm">Limited Beta Slots</div>
            </div>
            <div className="w-px h-12 bg-slate-700" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">100%</div>
              <div className="text-sm">FSAI Compliant</div>
            </div>
            <div className="w-px h-12 bg-slate-700" />
            <div className="text-center">
              <div className="text-3xl font-bold text-white">2+ hrs</div>
              <div className="text-sm">Saved Daily</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pain Points Section */}
      <section className="py-20 px-4 bg-slate-950/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Sound Familiar?
            </h2>
            <p className="text-slate-400 text-lg">
              These problems cost restaurants €10,000+ in fines every year
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: AlertTriangle,
                title: "Missed Temperature Checks",
                description: "Forgot to log that cooling batch? That's an instant critical violation.",
                color: "red"
              },
              {
                icon: Clock,
                title: "Hours of Paperwork",
                description: "Staff waste 2+ hours daily filling out temperature logs and compliance forms.",
                color: "amber"
              },
              {
                icon: FileCheck,
                title: "Missing Records",
                description: "Inspector asks for last month's records... and you can't find them.",
                color: "red"
              }
            ].map((pain, idx) => (
              <div key={idx} className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
                  pain.color === 'red' ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                )}>
                  <pain.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-2">{pain.title}</h3>
                <p className="text-slate-400">{pain.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              AI-Powered Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Compliance Made <span className="text-emerald-400">Effortless</span>
            </h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">
              Just speak and we handle the rest. No more clipboards, no more missed logs.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                icon: Mic,
                title: "Voice Commands",
                description: "Say 'Start cooling bolognese' and we track everything automatically. Hands-free compliance for busy kitchens.",
                gradient: "from-purple-500 to-pink-500"
              },
              {
                icon: Thermometer,
                title: "Smart Temperature Tracking",
                description: "90-minute cooling timers, fridge temp logs, and automatic alerts before things go wrong.",
                gradient: "from-cyan-500 to-blue-500"
              },
              {
                icon: FileCheck,
                title: "FSAI-Ready Reports",
                description: "One-click PDF reports for inspectors. All your records organized and searchable.",
                gradient: "from-emerald-500 to-green-500"
              },
              {
                icon: BarChart3,
                title: "Real-Time Dashboard",
                description: "See all active cooling sessions, compliance status, and alerts at a glance.",
                gradient: "from-amber-500 to-orange-500"
              }
            ].map((feature, idx) => (
              <div key={idx} className="group p-8 bg-gradient-to-br from-slate-900 to-slate-900/50 rounded-3xl border border-slate-800 hover:border-emerald-500/30 transition-all hover:shadow-xl hover:shadow-emerald-500/5">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br",
                  feature.gradient
                )}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3 group-hover:text-emerald-400 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-slate-400 text-lg leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gradient-to-b from-slate-950 to-emerald-950/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-slate-400 text-lg">
              Start free, upgrade when you're ready. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Tier 1 - Basic */}
            <div 
              onClick={() => {
                setSelectedTier('tier1')
                setIsSignUpOpen(true)
              }}
              className={cn(
                "relative p-8 rounded-3xl border-2 cursor-pointer transition-all hover:scale-105",
                "bg-slate-900/50 border-slate-700 hover:border-emerald-500/50"
              )}
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-300 mb-2">Starter</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">€29</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Billed monthly</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "1 Kitchen Location",
                  "Cooling Timer Tracking",
                  "Basic Temperature Logs",
                  "Email Support",
                  "PDF Reports"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl border-2 border-slate-600 text-slate-300 font-semibold hover:border-emerald-500 hover:text-white transition-colors">
                Start Free Trial
              </button>
            </div>

            {/* Tier 2 - Pro (Popular) */}
            <div 
              onClick={() => {
                setSelectedTier('tier2')
                setIsSignUpOpen(true)
              }}
              className={cn(
                "relative p-8 rounded-3xl border-2 cursor-pointer transition-all hover:scale-105",
                "bg-gradient-to-br from-emerald-900/30 to-cyan-900/20 border-emerald-500"
              )}
            >
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full text-sm font-bold">
                MOST POPULAR
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-emerald-300 mb-2">Professional</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">€79</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-sm text-emerald-500/70 mt-1">Save €190/year with annual</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Up to 3 Locations",
                  "Voice Commands",
                  "FSAI/HACCP Templates",
                  "Priority Support",
                  "Team Management",
                  "Menu Engineering",
                  "Custom Branding"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-white">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all">
                Start Free Trial
              </button>
            </div>

            {/* Tier 3 - Enterprise */}
            <div 
              onClick={() => {
                setSelectedTier('tier3')
                setIsSignUpOpen(true)
              }}
              className={cn(
                "relative p-8 rounded-3xl border-2 cursor-pointer transition-all hover:scale-105",
                "bg-slate-900/50 border-slate-700 hover:border-cyan-500/50"
              )}
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-cyan-300 mb-2">Enterprise</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">€199</span>
                  <span className="text-slate-400">/month</span>
                </div>
                <p className="text-sm text-slate-500 mt-1">Custom pricing available</p>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Unlimited Locations",
                  "Everything in Pro",
                  "API Access",
                  "Dedicated Account Manager",
                  "Custom Integrations",
                  "White-Label Option",
                  "SLA Guarantee"
                ].map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-300">
                    <CheckCircle className="w-5 h-5 text-cyan-400 flex-shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-xl border-2 border-slate-600 text-slate-300 font-semibold hover:border-cyan-500 hover:text-white transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to <span className="text-emerald-400">Ace Your Next Inspection?</span>
          </h2>
          <p className="text-xl text-slate-300 mb-8">
            Join early-stage restaurants building compliance into their daily operations.
          </p>
          <button 
            onClick={() => setIsSignUpOpen(true)}
            className="group px-10 py-5 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl font-bold text-xl hover:shadow-2xl hover:shadow-emerald-500/30 transition-all flex items-center gap-3 mx-auto hover:scale-105"
          >
            Start Your 30-Day Free Trial
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-slate-500 mt-4">Simple setup • Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                <ChefHat className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold">ChefCompliance</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
            <p className="text-sm text-slate-500">© 2026 ChefCompliance. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Sign Up Modal */}
      <SignUpModal 
        isOpen={isSignUpOpen}
        onClose={() => setIsSignUpOpen(false)}
        selectedTier={selectedTier}
      />

      {/* Sign In Modal */}
      <SignInModal 
        isOpen={isSignInOpen}
        onClose={() => setIsSignInOpen(false)}
      />
    </div>
  )
}
