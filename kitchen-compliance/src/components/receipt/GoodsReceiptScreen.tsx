import { useState, useRef } from 'react'
import { 
  ArrowLeft, Camera, Upload, Scan, Package, Thermometer, 
  User, Building2, CheckCircle, X, Loader2,
  Plus, Trash2, FileText, AlertTriangle, Cpu, Zap, Settings,
  Snowflake, Sun, Wind, Image, ChevronLeft, ChevronRight, Layers
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore, type OCRModel } from '@/store/useAppStore'
import { toast } from 'sonner'
import { processInvoiceImage, isProviderAvailable, OCR_MODEL_INFO } from '@/services/ocrService'

interface GoodsReceiptScreenProps {
  onBack: () => void
  onNavigate?: (screen: string) => void
}

// Temperature categories for delivery items
type TempCategory = 'ambient' | 'chilled' | 'frozen'

const TEMP_CATEGORIES: Record<TempCategory, { label: string; icon: typeof Sun; color: string; bgColor: string; range: string; maxTemp: number }> = {
  ambient: { 
    label: 'Ambient', 
    icon: Sun, 
    color: 'text-amber-500', 
    bgColor: 'bg-amber-500/10',
    range: 'Room temperature',
    maxTemp: 25 
  },
  chilled: { 
    label: 'Chilled', 
    icon: Wind, 
    color: 'text-cyan-500', 
    bgColor: 'bg-cyan-500/10',
    range: '0°C to 5°C',
    maxTemp: 5 
  },
  frozen: { 
    label: 'Frozen', 
    icon: Snowflake, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500/10',
    range: '-18°C or below',
    maxTemp: -18 
  },
}

interface ReceiptItem {
  id: string
  name: string
  quantity: string
  unit: string
  tempCategory: TempCategory
  temperature?: string
  pageNumber?: number // Track which page the item came from
}

// Scanned page info
interface ScannedPage {
  id: string
  imageData: string
  pageNumber: number
  processed: boolean
  itemCount: number
}

interface ReceiptData {
  supplier: string
  dnNumber: string // Delivery Note number
  dnDate: string
  items: ReceiptItem[]
  receivedBy: string
  receivedAt: string
  // Group temperatures
  ambientTemp: string
  chilledTemp: string
  frozenTemp: string
  notes: string
}

const INITIAL_RECEIPT: ReceiptData = {
  supplier: '',
  dnNumber: '',
  dnDate: new Date().toISOString().split('T')[0],
  items: [],
  receivedBy: '',
  receivedAt: new Date().toISOString().slice(0, 16),
  ambientTemp: '',
  chilledTemp: '',
  frozenTemp: '',
  notes: '',
}

export function GoodsReceiptScreen({ onBack, onNavigate }: GoodsReceiptScreenProps) {
  const { staffMembers, settings } = useAppStore()
  const [receipt, setReceipt] = useState<ReceiptData>(INITIAL_RECEIPT)
  const [isScanning, setIsScanning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Multi-page state
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [processingPageId, setProcessingPageId] = useState<string | null>(null)
  
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [ocrResult, setOcrResult] = useState<{ provider: string; model: string } | null>(null)
  const [scanProgress, setScanProgress] = useState<{ progress: number; status: string } | null>(null)
  const [activeCategory, setActiveCategory] = useState<TempCategory | 'all'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const addPageInputRef = useRef<HTMLInputElement>(null)
  
  // Get current OCR settings
  const ocrProvider = settings.ocrProvider || 'tesseract'
  const ocrModel = settings.ocrModel || 'tesseract'
  const isOcrConfigured = isProviderAvailable(ocrProvider, {
    openaiApiKey: settings.openaiApiKey,
    openrouterApiKey: settings.openrouterApiKey,
  })
  
  // Get model info
  const modelInfo = OCR_MODEL_INFO[ocrModel]

  // Process a single page with OCR
  const processPage = async (page: ScannedPage, file: File) => {
    setProcessingPageId(page.id)
    setScanProgress({ progress: 0, status: `Processing page ${page.pageNumber}...` })
    
    try {
      const ocrResultData = await processInvoiceImage(
        file, 
        {
          provider: ocrProvider,
          model: ocrModel,
          openaiApiKey: settings.openaiApiKey,
          openrouterApiKey: settings.openrouterApiKey,
        },
        (progress, status) => {
          setScanProgress({ progress, status: `Page ${page.pageNumber}: ${status}` })
        }
      )
      
      if (ocrResultData) {
        // Convert OCR items to have tempCategory and page number
        const itemsWithCategory: ReceiptItem[] = ocrResultData.items.map(item => ({
          ...item,
          tempCategory: 'chilled' as TempCategory,
          pageNumber: page.pageNumber,
        }))
        
        // For first page, extract supplier/DN info. For subsequent pages, just add items
        if (page.pageNumber === 1) {
          setReceipt(prev => ({
            ...prev,
            supplier: ocrResultData.supplier || prev.supplier,
            dnNumber: ocrResultData.invoiceNumber || prev.dnNumber,
            dnDate: ocrResultData.invoiceDate || prev.dnDate,
            items: [...prev.items, ...itemsWithCategory],
          }))
        } else {
          // Just add items for pages 2+
          setReceipt(prev => ({
            ...prev,
            items: [...prev.items, ...itemsWithCategory],
          }))
        }
        
        // Mark page as processed and update item count
        setScannedPages(prev => prev.map(p => 
          p.id === page.id 
            ? { ...p, processed: true, itemCount: itemsWithCategory.length }
            : p
        ))
        
        setOcrConfidence(ocrResultData.confidence)
        setOcrResult({ provider: ocrResultData.provider, model: ocrResultData.model })
        
        const providerName = OCR_MODEL_INFO[ocrResultData.model as OCRModel]?.name || ocrResultData.model
        toast.success(`Page ${page.pageNumber}: ${itemsWithCategory.length} items extracted via ${providerName}`)
      }
    } catch (error) {
      console.error('OCR error:', error)
      toast.error(`Failed to scan page ${page.pageNumber}`)
    } finally {
      setProcessingPageId(null)
      setScanProgress(null)
    }
  }

  // Handle file upload (supports multiple files for multi-page)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isAddingPage = false) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsScanning(true)
    
    const startPageNum = isAddingPage ? scannedPages.length + 1 : 1
    
    // If not adding page, clear existing pages
    if (!isAddingPage) {
      setScannedPages([])
      setReceipt(INITIAL_RECEIPT)
    }
    
    // Process each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const pageNum = startPageNum + i
      
      // Convert to base64 for preview
      const imageData = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (event) => resolve(event.target?.result as string)
        reader.readAsDataURL(file)
      })
      
      const newPage: ScannedPage = {
        id: crypto.randomUUID(),
        imageData,
        pageNumber: pageNum,
        processed: false,
        itemCount: 0,
      }
      
      setScannedPages(prev => [...prev, newPage])
      setCurrentPageIndex(isAddingPage ? scannedPages.length : i)
      
      // Process the page
      await processPage(newPage, file)
    }
    
    setIsScanning(false)
    
    // Reset input
    e.target.value = ''
  }

  // Remove a specific page
  const removePage = (pageId: string) => {
    const pageToRemove = scannedPages.find(p => p.id === pageId)
    if (!pageToRemove) return
    
    // Remove items from this page
    setReceipt(prev => ({
      ...prev,
      items: prev.items.filter(item => item.pageNumber !== pageToRemove.pageNumber),
    }))
    
    // Remove the page and renumber remaining pages
    setScannedPages(prev => {
      const filtered = prev.filter(p => p.id !== pageId)
      return filtered.map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
    })
    
    // Update items with new page numbers
    setReceipt(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.pageNumber && item.pageNumber > pageToRemove.pageNumber) {
          return { ...item, pageNumber: item.pageNumber - 1 }
        }
        return item
      }),
    }))
    
    // Adjust current page index
    if (currentPageIndex >= scannedPages.length - 1) {
      setCurrentPageIndex(Math.max(0, scannedPages.length - 2))
    }
    
    toast.success(`Page ${pageToRemove.pageNumber} removed`)
  }

  // Clear all pages
  const clearAllPages = () => {
    setScannedPages([])
    setReceipt(INITIAL_RECEIPT)
    setOcrConfidence(null)
    setOcrResult(null)
    setCurrentPageIndex(0)
  }

  // Update receipt field
  const updateField = (field: keyof ReceiptData, value: string) => {
    setReceipt(prev => ({ ...prev, [field]: value }))
  }

  // Add new item
  const addItem = (category: TempCategory = 'chilled') => {
    const newItem: ReceiptItem = {
      id: crypto.randomUUID(),
      name: '',
      quantity: '',
      unit: 'kg',
      tempCategory: category,
      temperature: '',
      pageNumber: undefined, // Manual items don't have page number
    }
    setReceipt(prev => ({ ...prev, items: [...prev.items, newItem] }))
  }

  // Update item
  const updateItem = (id: string, field: keyof ReceiptItem, value: string) => {
    setReceipt(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.id === id ? { ...item, [field]: value } : item
      ),
    }))
  }

  // Remove item
  const removeItem = (id: string) => {
    setReceipt(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }))
  }

  // Apply group temperature to all items in category
  const applyGroupTemp = (category: TempCategory, temp: string) => {
    setReceipt(prev => ({
      ...prev,
      items: prev.items.map(item => 
        item.tempCategory === category ? { ...item, temperature: temp } : item
      ),
    }))
    
    const count = receipt.items.filter(i => i.tempCategory === category).length
    if (count > 0) {
      toast.success(`Applied ${temp}°C to ${count} ${TEMP_CATEGORIES[category].label.toLowerCase()} items`)
    }
  }

  // Get items by category
  const getItemsByCategory = (category: TempCategory) => 
    receipt.items.filter(item => item.tempCategory === category)

  // Validate form
  const isValid = () => {
    return (
      receipt.supplier.trim() &&
      receipt.receivedBy &&
      receipt.items.length > 0 &&
      receipt.items.every(item => item.name.trim() && item.quantity.trim())
    )
  }

  // Submit receipt
  const handleSubmit = async () => {
    if (!isValid()) {
      toast.error('Please fill in all required fields')
      return
    }

    setIsSubmitting(true)
    
    try {
      // TODO: Save to Supabase
      console.log('📦 Goods Receipt:', receipt)
      console.log('📄 Pages scanned:', scannedPages.length)
      
      toast.success('Goods receipt recorded successfully!')
      
      // Reset form
      setReceipt(INITIAL_RECEIPT)
      setScannedPages([])
      setOcrConfidence(null)
      setOcrResult(null)
      
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Failed to save receipt')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check temperature compliance
  const isTempCompliant = (temp: string, category: TempCategory) => {
    const tempNum = parseFloat(temp)
    if (isNaN(tempNum)) return null
    const maxTemp = TEMP_CATEGORIES[category].maxTemp
    return category === 'frozen' ? tempNum <= maxTemp : tempNum <= maxTemp
  }

  // Get filtered items based on active category
  const filteredItems = activeCategory === 'all' 
    ? receipt.items 
    : receipt.items.filter(item => item.tempCategory === activeCategory)

  // Current page for display
  const currentPage = scannedPages[currentPageIndex]

  return (
    <div className="min-h-full bg-theme-primary text-theme-primary pb-20 lg:pb-6">
      {/* Header */}
      <div className="bg-theme-card border-b border-theme-primary px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="lg:hidden p-2 -ml-2 rounded-xl hover:bg-theme-ghost transition-colors text-theme-secondary hover:text-theme-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2 text-theme-primary">
              <Package className="w-6 h-6 text-emerald-500" />
              Goods Receipt
            </h1>
            <p className="text-sm text-theme-muted">
              Scan delivery note & record intake
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Delivery Note Scanner Section */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-theme-primary">
              <Scan className="w-5 h-5 text-cyan-500" />
              Scan Delivery Note
              {scannedPages.length > 0 && (
                <span className="text-sm font-normal text-theme-muted ml-2">
                  ({scannedPages.length} {scannedPages.length === 1 ? 'page' : 'pages'})
                </span>
              )}
            </h2>
            
            {/* OCR Provider Badge with Settings link */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                ocrProvider === 'openrouter' ? "bg-purple-500/20 text-purple-400" :
                ocrProvider === 'openai' ? "bg-sky-500/20 text-sky-400" :
                "bg-emerald-500/20 text-emerald-400"
              )}>
                {ocrProvider === 'tesseract' ? (
                  <>
                    <Cpu className="w-3.5 h-3.5" />
                    Tesseract (Free)
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    {modelInfo?.name || ocrModel}
                  </>
                )}
              </div>
              
              {onNavigate && (
                <button
                  onClick={() => onNavigate('settings')}
                  className="p-1.5 rounded-lg hover:bg-theme-ghost text-theme-muted hover:text-theme-primary transition-colors"
                  title="OCR Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {scannedPages.length === 0 ? (
            // Initial scan buttons
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Camera capture */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1 p-6 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-primary hover:border-emerald-500 transition-colors flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Camera className="w-7 h-7 text-emerald-500" />
                </div>
                <span className="font-medium text-theme-primary">Take Photo</span>
                <span className="text-sm text-theme-muted">Use camera to scan DN</span>
              </button>

              {/* File upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1 p-6 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-primary hover:border-cyan-500 transition-colors flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-cyan-500" />
                </div>
                <span className="font-medium text-theme-primary">Upload File(s)</span>
                <span className="text-sm text-theme-muted">Select one or more images</span>
              </button>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => handleFileUpload(e, false)}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={(e) => handleFileUpload(e, false)}
                className="hidden"
              />
            </div>
          ) : (
            // Multi-page viewer
            <div className="space-y-4">
              {/* Page thumbnails strip */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {scannedPages.map((page, idx) => (
                  <button
                    key={page.id}
                    onClick={() => setCurrentPageIndex(idx)}
                    className={cn(
                      "relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all",
                      currentPageIndex === idx 
                        ? "border-emerald-500 ring-2 ring-emerald-500/30" 
                        : "border-theme-primary hover:border-theme-secondary"
                    )}
                  >
                    <img 
                      src={page.imageData} 
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs px-1 py-0.5 text-center">
                      {page.pageNumber}
                    </div>
                    {page.processed && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                    {processingPageId === page.id && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      </div>
                    )}
                  </button>
                ))}
                
                {/* Add page button */}
                <button
                  onClick={() => addPageInputRef.current?.click()}
                  disabled={isScanning}
                  className="flex-shrink-0 w-16 h-20 rounded-lg border-2 border-dashed border-theme-primary hover:border-emerald-500 transition-colors flex flex-col items-center justify-center gap-1 text-theme-muted hover:text-emerald-500"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-[10px]">Add</span>
                </button>
                
                <input
                  ref={addPageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileUpload(e, true)}
                  className="hidden"
                />
              </div>

              {/* Current page preview */}
              {currentPage && (
                <div className="relative">
                  <img
                    src={currentPage.imageData}
                    alt={`Page ${currentPage.pageNumber}`}
                    className="w-full max-h-64 object-contain rounded-xl bg-black/20"
                  />
                  
                  {/* Page navigation */}
                  {scannedPages.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                        disabled={currentPageIndex === 0}
                        className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-lg hover:bg-black/70 transition-colors disabled:opacity-30"
                      >
                        <ChevronLeft className="w-5 h-5 text-white" />
                      </button>
                      <button
                        onClick={() => setCurrentPageIndex(Math.min(scannedPages.length - 1, currentPageIndex + 1))}
                        disabled={currentPageIndex === scannedPages.length - 1}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 rounded-lg hover:bg-black/70 transition-colors disabled:opacity-30"
                      >
                        <ChevronRight className="w-5 h-5 text-white" />
                      </button>
                    </>
                  )}
                  
                  {/* Remove page button */}
                  <button
                    onClick={() => removePage(currentPage.id)}
                    className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors"
                    title="Remove this page"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  
                  {/* Page info badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-2">
                    <span className="px-2 py-1 bg-black/70 text-white text-xs rounded-lg flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      Page {currentPage.pageNumber} of {scannedPages.length}
                    </span>
                    {currentPage.processed && (
                      <span className="px-2 py-1 bg-emerald-500 text-white text-xs rounded-lg">
                        {currentPage.itemCount} items
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* OCR confidence indicator */}
              {ocrConfidence !== null && ocrResult && (
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm",
                  ocrConfidence > 70 
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-amber-500/20 text-amber-400"
                )}>
                  {ocrConfidence > 70 ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>
                    {OCR_MODEL_INFO[ocrResult.model as OCRModel]?.name || ocrResult.model}: {ocrConfidence.toFixed(0)}% confidence
                    {ocrConfidence <= 70 && ' - Please verify extracted data'}
                  </span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => addPageInputRef.current?.click()}
                  className="flex-1 py-2 bg-emerald-500/20 text-emerald-500 rounded-lg text-sm font-medium hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Page
                </button>
                <button
                  onClick={clearAllPages}
                  className="px-4 py-2 bg-theme-secondary rounded-lg text-sm hover:bg-theme-ghost transition-colors text-theme-primary"
                >
                  Clear All
                </button>
              </div>
            </div>
          )}

          {isScanning && (
            <div className="mt-4 flex flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              {scanProgress ? (
                <>
                  <span className="text-theme-muted">{scanProgress.status}</span>
                  {scanProgress.progress > 0 && (
                    <div className="w-full max-w-xs bg-theme-secondary rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${scanProgress.progress}%` }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <span className="text-theme-muted">Processing delivery note...</span>
              )}
            </div>
          )}
          
          {/* Provider info / API key warning */}
          {scannedPages.length === 0 && (
            <div className="mt-4 p-3 bg-theme-ghost rounded-lg text-xs text-theme-muted">
              {!isOcrConfigured && ocrProvider !== 'tesseract' ? (
                <p className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {ocrProvider === 'openai' ? 'OpenAI' : 'OpenRouter'} API key not configured. 
                    {onNavigate && (
                      <button 
                        onClick={() => onNavigate('settings')}
                        className="underline ml-1"
                      >
                        Go to Settings
                      </button>
                    )}
                  </span>
                </p>
              ) : (
                <p className="flex items-center gap-2">
                  <Image className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                  <span>
                    <strong>Multi-page support:</strong> Upload multiple images at once, or add pages one by one.
                    Items from all pages will be combined into one delivery note.
                  </span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Supplier & Delivery Note Info */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-primary">
            <Building2 className="w-5 h-5 text-purple-500" />
            Supplier & Delivery Details
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-theme-muted block mb-1.5">Supplier Name *</label>
              <input
                type="text"
                value={receipt.supplier}
                onChange={(e) => updateField('supplier', e.target.value)}
                placeholder="e.g., Fresh Foods Ltd"
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-sm text-theme-muted block mb-1.5">Delivery Note Number</label>
              <input
                type="text"
                value={receipt.dnNumber}
                onChange={(e) => updateField('dnNumber', e.target.value)}
                placeholder="e.g., DN-2026-001234"
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-sm text-theme-muted block mb-1.5">Delivery Date</label>
              <input
                type="date"
                value={receipt.dnDate}
                onChange={(e) => updateField('dnDate', e.target.value)}
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Group Temperature Controls */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-primary">
            <Thermometer className="w-5 h-5 text-cyan-500" />
            Group Temperature Check
          </h2>
          <p className="text-sm text-theme-muted mb-4">
            Enter temperature once per category to apply to all items in that group
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Ambient */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              getItemsByCategory('ambient').length > 0 
                ? "border-amber-500/50 bg-amber-500/5"
                : "border-theme-primary bg-theme-secondary opacity-50"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Sun className="w-5 h-5 text-amber-500" />
                <span className="font-semibold text-amber-500">Ambient</span>
                <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full ml-auto">
                  {getItemsByCategory('ambient').length} items
                </span>
              </div>
              <p className="text-xs text-theme-muted mb-2">Room temperature items</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={receipt.ambientTemp}
                  onChange={(e) => updateField('ambientTemp', e.target.value)}
                  placeholder="°C"
                  disabled={getItemsByCategory('ambient').length === 0}
                  className="flex-1 px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={() => applyGroupTemp('ambient', receipt.ambientTemp)}
                  disabled={!receipt.ambientTemp || getItemsByCategory('ambient').length === 0}
                  className="px-3 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Chilled */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              getItemsByCategory('chilled').length > 0 
                ? "border-cyan-500/50 bg-cyan-500/5"
                : "border-theme-primary bg-theme-secondary opacity-50"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Wind className="w-5 h-5 text-cyan-500" />
                <span className="font-semibold text-cyan-500">Chilled</span>
                <span className="text-xs bg-cyan-500/20 text-cyan-500 px-2 py-0.5 rounded-full ml-auto">
                  {getItemsByCategory('chilled').length} items
                </span>
              </div>
              <p className="text-xs text-theme-muted mb-2">0°C to 5°C (FSAI limit)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={receipt.chilledTemp}
                  onChange={(e) => updateField('chilledTemp', e.target.value)}
                  placeholder="°C"
                  disabled={getItemsByCategory('chilled').length === 0}
                  className="flex-1 px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => applyGroupTemp('chilled', receipt.chilledTemp)}
                  disabled={!receipt.chilledTemp || getItemsByCategory('chilled').length === 0}
                  className="px-3 py-2 bg-cyan-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>

            {/* Frozen */}
            <div className={cn(
              "p-4 rounded-xl border-2 transition-all",
              getItemsByCategory('frozen').length > 0 
                ? "border-blue-500/50 bg-blue-500/5"
                : "border-theme-primary bg-theme-secondary opacity-50"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <Snowflake className="w-5 h-5 text-blue-500" />
                <span className="font-semibold text-blue-500">Frozen</span>
                <span className="text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full ml-auto">
                  {getItemsByCategory('frozen').length} items
                </span>
              </div>
              <p className="text-xs text-theme-muted mb-2">-18°C or below (FSAI limit)</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={receipt.frozenTemp}
                  onChange={(e) => updateField('frozenTemp', e.target.value)}
                  placeholder="°C"
                  disabled={getItemsByCategory('frozen').length === 0}
                  className="flex-1 px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => applyGroupTemp('frozen', receipt.frozenTemp)}
                  disabled={!receipt.frozenTemp || getItemsByCategory('frozen').length === 0}
                  className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-theme-primary">
              <FileText className="w-5 h-5 text-amber-500" />
              Items Received
            </h2>
            <div className="flex items-center gap-2">
              {/* Category filter tabs */}
              <div className="flex bg-theme-secondary rounded-lg p-1">
                <button
                  onClick={() => setActiveCategory('all')}
                  className={cn(
                    "px-3 py-1 rounded text-xs font-medium transition-colors",
                    activeCategory === 'all' 
                      ? "bg-theme-card text-theme-primary shadow" 
                      : "text-theme-muted hover:text-theme-primary"
                  )}
                >
                  All ({receipt.items.length})
                </button>
                {(['ambient', 'chilled', 'frozen'] as TempCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
                      activeCategory === cat 
                        ? "bg-theme-card text-theme-primary shadow" 
                        : "text-theme-muted hover:text-theme-primary"
                    )}
                  >
                    {cat === 'ambient' && <Sun className="w-3 h-3 text-amber-500" />}
                    {cat === 'chilled' && <Wind className="w-3 h-3 text-cyan-500" />}
                    {cat === 'frozen' && <Snowflake className="w-3 h-3 text-blue-500" />}
                    {getItemsByCategory(cat).length}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Add item buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => addItem('ambient')}
              className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500/20 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <Sun className="w-4 h-4" />
              Ambient
            </button>
            <button
              onClick={() => addItem('chilled')}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-500/10 text-cyan-500 rounded-lg hover:bg-cyan-500/20 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <Wind className="w-4 h-4" />
              Chilled
            </button>
            <button
              onClick={() => addItem('frozen')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              <Snowflake className="w-4 h-4" />
              Frozen
            </button>
          </div>

          {receipt.items.length === 0 ? (
            <div className="text-center py-8 text-theme-muted">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No items added yet</p>
              <p className="text-sm">Scan a delivery note or add items manually</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item, idx) => {
                const catConfig = TEMP_CATEGORIES[item.tempCategory]
                const TempIcon = catConfig.icon
                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "p-4 rounded-xl border",
                      catConfig.bgColor,
                      item.tempCategory === 'ambient' ? "border-amber-500/30" :
                      item.tempCategory === 'chilled' ? "border-cyan-500/30" :
                      "border-blue-500/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1",
                        item.tempCategory === 'ambient' ? "bg-amber-500/20" :
                        item.tempCategory === 'chilled' ? "bg-cyan-500/20" :
                        "bg-blue-500/20"
                      )}>
                        <TempIcon className={cn("w-4 h-4", catConfig.color)} />
                      </div>
                      
                      <div className="flex-1 grid sm:grid-cols-5 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-xs text-theme-muted block mb-1">
                            Item Name *
                            {item.pageNumber && (
                              <span className="ml-1 text-theme-muted/50">(p.{item.pageNumber})</span>
                            )}
                          </label>
                          <input
                            type="text"
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            placeholder="e.g., Chicken Breast"
                            className="w-full px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        
                        <div>
                          <label className="text-xs text-theme-muted block mb-1">Quantity *</label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                              placeholder="5"
                              className="w-full px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-emerald-500"
                            />
                            <select
                              value={item.unit}
                              onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                              className="w-16 px-1 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-emerald-500"
                            >
                              <option value="kg">kg</option>
                              <option value="g">g</option>
                              <option value="l">L</option>
                              <option value="ml">ml</option>
                              <option value="pcs">pcs</option>
                              <option value="box">box</option>
                            </select>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-xs text-theme-muted block mb-1">Category</label>
                          <select
                            value={item.tempCategory}
                            onChange={(e) => updateItem(item.id, 'tempCategory', e.target.value)}
                            className={cn(
                              "w-full px-2 py-2 border rounded-lg text-sm focus:outline-none",
                              item.tempCategory === 'ambient' ? "bg-amber-500/10 border-amber-500/30" :
                              item.tempCategory === 'chilled' ? "bg-cyan-500/10 border-cyan-500/30" :
                              "bg-blue-500/10 border-blue-500/30"
                            )}
                          >
                            <option value="ambient">☀️ Ambient</option>
                            <option value="chilled">❄️ Chilled</option>
                            <option value="frozen">🧊 Frozen</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-xs text-theme-muted block mb-1">Temp (°C)</label>
                          <div className="relative">
                            <input
                              type="text"
                              value={item.temperature || ''}
                              onChange={(e) => updateItem(item.id, 'temperature', e.target.value)}
                              placeholder={catConfig.maxTemp.toString()}
                              className={cn(
                                "w-full px-3 py-2 bg-theme-card border rounded-lg text-sm text-theme-primary focus:outline-none",
                                item.temperature && isTempCompliant(item.temperature, item.tempCategory) === false
                                  ? "border-red-500 text-red-400"
                                  : "border-theme-primary focus:border-emerald-500"
                              )}
                            />
                            {item.temperature && isTempCompliant(item.temperature, item.tempCategory) !== null && (
                              <div className={cn(
                                "absolute right-2 top-1/2 -translate-y-1/2",
                                isTempCompliant(item.temperature, item.tempCategory) ? "text-emerald-500" : "text-red-500"
                              )}>
                                {isTempCompliant(item.temperature, item.tempCategory) ? (
                                  <CheckCircle className="w-4 h-4" />
                                ) : (
                                  <AlertTriangle className="w-4 h-4" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeItem(item.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Reception Details */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-primary">
            <User className="w-5 h-5 text-blue-500" />
            Reception Details
          </h2>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-theme-muted block mb-1.5">Received By *</label>
              <select
                value={receipt.receivedBy}
                onChange={(e) => updateField('receivedBy', e.target.value)}
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="">Select staff member...</option>
                {staffMembers.filter(s => s.active).map(staff => (
                  <option key={staff.id} value={staff.id}>
                    {staff.name} ({staff.initials})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-theme-muted block mb-1.5">Received At</label>
              <input
                type="datetime-local"
                value={receipt.receivedAt}
                onChange={(e) => updateField('receivedAt', e.target.value)}
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm text-theme-muted block mb-1.5">Notes</label>
              <textarea
                value={receipt.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any observations, damaged items, discrepancies..."
                rows={3}
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            onClick={onBack}
            className="px-6 py-4 bg-theme-card border border-theme-primary rounded-xl font-semibold text-theme-primary hover:bg-theme-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid() || isSubmitting}
            className={cn(
              "flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all text-white",
              isValid() && !isSubmitting
                ? "bg-gradient-to-r from-emerald-500 to-cyan-500 hover:shadow-lg hover:shadow-emerald-500/30"
                : "bg-theme-secondary text-theme-muted cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Record Receipt
                {scannedPages.length > 1 && (
                  <span className="text-sm font-normal opacity-80">
                    ({scannedPages.length} pages)
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
