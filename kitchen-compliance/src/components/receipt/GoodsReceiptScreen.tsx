import { useState, useRef } from 'react'
import {
  ArrowLeft, Camera, Upload, Scan, Package, Thermometer,
  User, Building2, CheckCircle, X, Loader2,
  Plus, Trash2, FileText, AlertTriangle, Zap, Settings,
  Snowflake, Sun, Wind, Image, ChevronLeft, ChevronRight, Layers,
  Tag, Beef, Calendar, Hash
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore, type OCRModel } from '@/store/useAppStore'
import { toast } from 'sonner'
import { processInvoiceImage, isProviderAvailable, OCR_MODEL_INFO } from '@/services/ocrService'
import {
  createGoodsReceipt,
  uploadDeliveryImage,
  type ReceiptItemInput,
} from '@/services/deliveryService'
import { formatFileSize, compressImage, COMPRESSION_PRESETS } from '@/lib/imageCompression'

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
  pageNumber?: number
}

// Scanned page info
interface ScannedPage {
  id: string
  imageData: string
  file: File
  pageNumber: number
  processed: boolean
  itemCount: number
}

// Protein label info
interface ProteinLabel {
  id: string
  imageData: string
  file: File
  productName: string
  batchNumber: string
  useByDate: string
  supplierCode: string
}

interface ReceiptData {
  supplier: string
  dnNumber: string
  dnDate: string
  items: ReceiptItem[]
  receivedBy: string
  receivedAt: string
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
  const { staffMembers, settings, currentSite } = useAppStore()
  const [receipt, setReceipt] = useState<ReceiptData>(INITIAL_RECEIPT)
  const [isScanning, setIsScanning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitProgress, setSubmitProgress] = useState<string | null>(null)

  // Multi-page delivery note state
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([])
  const [currentPageIndex, setCurrentPageIndex] = useState(0)
  const [processingPageId, setProcessingPageId] = useState<string | null>(null)

  // Protein labels state
  const [proteinLabels, setProteinLabels] = useState<ProteinLabel[]>([])
  const [isCapturingLabel, setIsCapturingLabel] = useState(false)

  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const [ocrResult, setOcrResult] = useState<{ provider: string; model: string } | null>(null)
  const [scanProgress, setScanProgress] = useState<{ progress: number; status: string } | null>(null)
  const [activeCategory, setActiveCategory] = useState<TempCategory | 'all'>('all')

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const addPageInputRef = useRef<HTMLInputElement>(null)
  const labelCameraRef = useRef<HTMLInputElement>(null)
  const labelFileRef = useRef<HTMLInputElement>(null)

  // Get current OCR settings
  const ocrProvider = settings.ocrProvider || 'openrouter'
  const ocrModel = settings.ocrModel || 'google/gemini-2.0-flash'
  const isOcrConfigured = isProviderAvailable(ocrProvider, {
    openaiApiKey: settings.openaiApiKey,
    openrouterApiKey: settings.openrouterApiKey,
  })

  const modelInfo = OCR_MODEL_INFO[ocrModel]

  // Process a single page with OCR
  const processPage = async (page: ScannedPage, file: File) => {
    setProcessingPageId(page.id)

    try {
      let fileToProcess = file

      // Compress large images (> 2MB) to prevent mobile network timeouts
      if (file.size > 2 * 1024 * 1024) {
        setScanProgress({ progress: 5, status: `Compressing large image...` })
        console.log(`📸 Compressing large image: ${formatFileSize(file.size)}`)
        const compressed = await compressImage(file, COMPRESSION_PRESETS.deliveryNote)
        console.log(`📸 Compressed: ${formatFileSize(file.size)} → ${formatFileSize(compressed.compressedSize)} (${compressed.compressionRatio}% reduction)`)
        fileToProcess = new File([compressed.blob], file.name, { type: compressed.blob.type })
      } else {
        console.log(`☁️ Using original file (${formatFileSize(file.size)}) - small enough for direct upload`)
      }

      setScanProgress({ progress: 10, status: `Processing page ${page.pageNumber}...` })

      const ocrResultData = await processInvoiceImage(
        fileToProcess,
        {
          provider: ocrProvider,
          model: ocrModel,
          openaiApiKey: settings.openaiApiKey,
          openrouterApiKey: settings.openrouterApiKey,
        },
        (progress, status) => {
          // Scale progress from 10-100
          const scaledProgress = 10 + Math.round(progress * 0.9)
          setScanProgress({ progress: scaledProgress, status: `Page ${page.pageNumber}: ${status}` })
        }
      )

      if (ocrResultData) {
        const itemsWithCategory: ReceiptItem[] = ocrResultData.items.map(item => ({
          ...item,
          tempCategory: 'chilled' as TempCategory,
          pageNumber: page.pageNumber,
        }))

        if (page.pageNumber === 1) {
          setReceipt(prev => ({
            ...prev,
            supplier: ocrResultData.supplier || prev.supplier,
            dnNumber: ocrResultData.invoiceNumber || prev.dnNumber,
            dnDate: ocrResultData.invoiceDate || prev.dnDate,
            items: [...prev.items, ...itemsWithCategory],
          }))
        } else {
          setReceipt(prev => ({
            ...prev,
            items: [...prev.items, ...itemsWithCategory],
          }))
        }

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      toast.error(`Page ${page.pageNumber} failed: ${errorMessage.substring(0, 100)}`)
    } finally {
      setProcessingPageId(null)
      setScanProgress(null)
    }
  }

  // Handle delivery note file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isAddingPage = false) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsScanning(true)

    const startPageNum = isAddingPage ? scannedPages.length + 1 : 1

    if (!isAddingPage) {
      setScannedPages([])
      setReceipt(prev => ({ ...prev, items: [] }))
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const pageNum = startPageNum + i

      const imageData = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (event) => resolve(event.target?.result as string)
        reader.readAsDataURL(file)
      })

      const newPage: ScannedPage = {
        id: crypto.randomUUID(),
        imageData,
        file,
        pageNumber: pageNum,
        processed: false,
        itemCount: 0,
      }

      setScannedPages(prev => [...prev, newPage])
      setCurrentPageIndex(isAddingPage ? scannedPages.length : i)

      await processPage(newPage, file)
    }

    setIsScanning(false)
    e.target.value = ''
  }

  // Handle protein label capture (no OCR, just store)
  const handleLabelCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsCapturingLabel(true)

    for (const file of files) {
      const imageData = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (event) => resolve(event.target?.result as string)
        reader.readAsDataURL(file)
      })

      const newLabel: ProteinLabel = {
        id: crypto.randomUUID(),
        imageData,
        file,
        productName: '',
        batchNumber: '',
        useByDate: '',
        supplierCode: '',
      }

      setProteinLabels(prev => [...prev, newLabel])
    }

    setIsCapturingLabel(false)
    toast.success(`${files.length} label(s) captured`)
    e.target.value = ''
  }

  // Update protein label field
  const updateLabel = (id: string, field: keyof ProteinLabel, value: string) => {
    setProteinLabels(prev => prev.map(label =>
      label.id === id ? { ...label, [field]: value } : label
    ))
  }

  // Remove protein label
  const removeLabel = (id: string) => {
    setProteinLabels(prev => prev.filter(label => label.id !== id))
    toast.success('Label removed')
  }

  // Remove a specific page
  const removePage = (pageId: string) => {
    const pageToRemove = scannedPages.find(p => p.id === pageId)
    if (!pageToRemove) return

    setReceipt(prev => ({
      ...prev,
      items: prev.items.filter(item => item.pageNumber !== pageToRemove.pageNumber),
    }))

    setScannedPages(prev => {
      const filtered = prev.filter(p => p.id !== pageId)
      return filtered.map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
    })

    setReceipt(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.pageNumber && item.pageNumber > pageToRemove.pageNumber) {
          return { ...item, pageNumber: item.pageNumber - 1 }
        }
        return item
      }),
    }))

    if (currentPageIndex >= scannedPages.length - 1) {
      setCurrentPageIndex(Math.max(0, scannedPages.length - 2))
    }

    toast.success(`Page ${pageToRemove.pageNumber} removed`)
  }

  const clearAllPages = () => {
    setScannedPages([])
    setReceipt(prev => ({ ...prev, items: [] }))
    setOcrConfidence(null)
    setOcrResult(null)
    setCurrentPageIndex(0)
  }

  const updateField = (field: keyof ReceiptData, value: string) => {
    setReceipt(prev => ({ ...prev, [field]: value }))
  }

  const addItem = (category: TempCategory = 'chilled') => {
    const newItem: ReceiptItem = {
      id: crypto.randomUUID(),
      name: '',
      quantity: '',
      unit: 'kg',
      tempCategory: category,
      temperature: '',
      pageNumber: undefined,
    }
    setReceipt(prev => ({ ...prev, items: [...prev.items, newItem] }))
  }

  const updateItem = (id: string, field: keyof ReceiptItem, value: string) => {
    setReceipt(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    }))
  }

  const removeItem = (id: string) => {
    setReceipt(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id),
    }))
  }

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

  const getItemsByCategory = (category: TempCategory) =>
    receipt.items.filter(item => item.tempCategory === category)

  const isValid = () => {
    return (
      receipt.supplier.trim() &&
      receipt.receivedBy &&
      receipt.items.length > 0 &&
      receipt.items.every(item => item.name.trim() && item.quantity.trim())
    )
  }

  // Submit receipt with images
  const handleSubmit = async () => {
    if (!isValid()) {
      toast.error('Please fill in all required fields')
      return
    }

    const siteId = currentSite?.id
    if (!siteId) {
      toast.error('No site selected')
      return
    }

    setIsSubmitting(true)
    setSubmitProgress('Creating receipt...')

    try {
      // Get staff name
      const selectedStaff = staffMembers.find(s => s.id === receipt.receivedBy)
      const receivedByName = selectedStaff?.name || 'Unknown'

      // Convert items
      const items: ReceiptItemInput[] = receipt.items.map((item, idx) => ({
        itemName: item.name,
        quantity: parseFloat(item.quantity) || 1,
        unit: item.unit,
        temperature: item.temperature ? parseFloat(item.temperature) : undefined,
        temperatureCompliant: item.temperature
          ? isTempCompliant(item.temperature, item.tempCategory) ?? true
          : true,
        category: item.tempCategory as any,
        sortOrder: idx,
      }))

      // Calculate overall temperature (average of all item temperatures)
      const temps = items
        .map(item => item.temperature)
        .filter((t): t is number => t !== undefined && !isNaN(t))
      const overallTemperature = temps.length > 0
        ? temps.reduce((sum, t) => sum + t, 0) / temps.length
        : undefined
      const overallCompliant = items.length > 0
        ? items.every(item => item.temperatureCompliant)
        : true

      // Create the goods receipt
      const result = await createGoodsReceipt({
        siteId,
        supplierName: receipt.supplier,
        invoiceNumber: receipt.dnNumber || undefined,
        invoiceDate: receipt.dnDate || undefined,
        receivedByStaffId: receipt.receivedBy || undefined,
        receivedByName,
        receivedAt: receipt.receivedAt || new Date().toISOString(),
        overallTemperature,
        temperatureCompliant: overallCompliant,
        ocrRawText: ocrResult ? `Provider: ${ocrResult.provider}, Model: ${ocrResult.model}` : undefined,
        ocrConfidence: ocrConfidence || undefined,
        notes: receipt.notes || undefined,
        status: 'completed',
      }, items)

      if (!result) {
        throw new Error('Failed to create receipt')
      }

      const receiptId = result.receipt.id
      console.log('✅ Receipt created:', receiptId)

      // Upload delivery note pages
      if (scannedPages.length > 0) {
        setSubmitProgress(`Uploading ${scannedPages.length} delivery note page(s)...`)

        for (let i = 0; i < scannedPages.length; i++) {
          const page = scannedPages[i]
          setSubmitProgress(`Uploading delivery note page ${i + 1}/${scannedPages.length}...`)

          const uploaded = await uploadDeliveryImage({
            receiptId,
            imageType: 'delivery_note',
            file: page.file,
            originalFilename: page.file.name,
            pageNumber: page.pageNumber,
            ocrProcessed: page.processed,
          })

          if (uploaded) {
            console.log(`📄 Page ${i + 1} uploaded: ${formatFileSize(uploaded.compressedSizeBytes || 0)}`)
          }
        }
      }

      // Upload protein labels
      if (proteinLabels.length > 0) {
        setSubmitProgress(`Uploading ${proteinLabels.length} protein label(s)...`)

        for (let i = 0; i < proteinLabels.length; i++) {
          const label = proteinLabels[i]
          setSubmitProgress(`Uploading protein label ${i + 1}/${proteinLabels.length}...`)

          const uploaded = await uploadDeliveryImage({
            receiptId,
            imageType: 'protein_label',
            file: label.file,
            originalFilename: label.file.name,
            pageNumber: i + 1,
            productName: label.productName || undefined,
            batchNumber: label.batchNumber || undefined,
            useByDate: label.useByDate || undefined,
            supplierCode: label.supplierCode || undefined,
            ocrProcessed: false,
          })

          if (uploaded) {
            console.log(`🏷️ Label ${i + 1} uploaded: ${formatFileSize(uploaded.compressedSizeBytes || 0)}`)
          }
        }
      }

      toast.success('Goods receipt recorded successfully!')

      // Reset form
      setReceipt(INITIAL_RECEIPT)
      setScannedPages([])
      setProteinLabels([])
      setOcrConfidence(null)
      setOcrResult(null)
      setCurrentPageIndex(0)

    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Failed to save receipt')
    } finally {
      setIsSubmitting(false)
      setSubmitProgress(null)
    }
  }

  const isTempCompliant = (temp: string, category: TempCategory) => {
    const tempNum = parseFloat(temp)
    if (isNaN(tempNum)) return null
    const maxTemp = TEMP_CATEGORIES[category].maxTemp
    return category === 'frozen' ? tempNum <= maxTemp : tempNum <= maxTemp
  }

  const filteredItems = activeCategory === 'all'
    ? receipt.items
    : receipt.items.filter(item => item.tempCategory === activeCategory)

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
              Scan delivery note & protein labels for traceability
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

            <div className="flex items-center gap-2">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                ocrProvider === 'openrouter' ? "bg-purple-500/20 text-purple-400" :
                  "bg-sky-500/20 text-sky-400"
              )}>
                <Zap className="w-3.5 h-3.5" />
                {modelInfo?.name || ocrModel}
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
            <div className="flex flex-col gap-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1 p-6 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-primary hover:border-cyan-500 transition-colors flex flex-col items-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-cyan-500" />
                </div>
                <span className="font-medium text-theme-primary">Upload File(s)</span>
                <span className="text-sm text-theme-muted">Select images or take a photo</span>
              </button>

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
            <div className="space-y-4">
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

              {currentPage && (
                <div className="relative">
                  <img
                    src={currentPage.imageData}
                    alt={`Page ${currentPage.pageNumber}`}
                    className="w-full max-h-64 object-contain rounded-xl bg-black/20"
                  />

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

                  <button
                    onClick={() => removePage(currentPage.id)}
                    className="absolute top-2 right-2 p-2 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors"
                    title="Remove this page"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>

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

          {scannedPages.length === 0 && (
            <div className="mt-4 p-3 bg-theme-ghost rounded-lg text-xs text-theme-muted">
              {!isOcrConfigured ? (
                <p className="flex items-center gap-2 text-amber-500">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    API key not configured. Add your OpenAI or OpenRouter key in Settings to enable OCR scanning.
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

        {/* Protein Label Scanner Section - NEW */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2 text-theme-primary">
              <Tag className="w-5 h-5 text-rose-500" />
              Protein Traceability Labels
              {proteinLabels.length > 0 && (
                <span className="text-sm font-normal text-theme-muted ml-2">
                  ({proteinLabels.length} {proteinLabels.length === 1 ? 'label' : 'labels'})
                </span>
              )}
            </h2>
            <span className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded-full">
              For Traceability
            </span>
          </div>

          <p className="text-sm text-theme-muted mb-4">
            Capture photos of protein labels (beef, poultry, seafood) for FSAI traceability compliance.
            No OCR required - just scan and optionally add batch details.
          </p>

          {/* Label capture buttons */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <button
              onClick={() => labelCameraRef.current?.click()}
              disabled={isCapturingLabel}
              className="flex-1 p-4 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-primary hover:border-rose-500 transition-colors flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                <Camera className="w-6 h-6 text-rose-500" />
              </div>
              <div className="text-left">
                <span className="font-medium text-theme-primary block">Take Photo</span>
                <span className="text-sm text-theme-muted">Capture label with camera</span>
              </div>
            </button>

            <button
              onClick={() => labelFileRef.current?.click()}
              disabled={isCapturingLabel}
              className="flex-1 p-4 bg-theme-secondary rounded-xl border-2 border-dashed border-theme-primary hover:border-rose-500 transition-colors flex items-center gap-3"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/20 flex items-center justify-center flex-shrink-0">
                <Upload className="w-6 h-6 text-rose-500" />
              </div>
              <div className="text-left">
                <span className="font-medium text-theme-primary block">Upload</span>
                <span className="text-sm text-theme-muted">Select label image(s)</span>
              </div>
            </button>

            <input
              ref={labelCameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleLabelCapture}
              className="hidden"
            />
            <input
              ref={labelFileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleLabelCapture}
              className="hidden"
            />
          </div>

          {isCapturingLabel && (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-rose-500" />
              <span className="text-theme-muted">Processing...</span>
            </div>
          )}

          {/* Display captured labels */}
          {proteinLabels.length > 0 && (
            <div className="space-y-4">
              {proteinLabels.map((label, idx) => (
                <div
                  key={label.id}
                  className="p-4 bg-rose-500/5 border border-rose-500/30 rounded-xl"
                >
                  <div className="flex gap-4">
                    {/* Label image preview */}
                    <div className="relative flex-shrink-0">
                      <img
                        src={label.imageData}
                        alt={`Label ${idx + 1}`}
                        className="w-24 h-24 object-cover rounded-lg"
                      />
                      <div className="absolute -top-2 -left-2 w-6 h-6 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                        {idx + 1}
                      </div>
                    </div>

                    {/* Label metadata fields */}
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-theme-muted flex items-center gap-1 mb-1">
                          <Beef className="w-3 h-3" />
                          Product Name
                        </label>
                        <input
                          type="text"
                          value={label.productName}
                          onChange={(e) => updateLabel(label.id, 'productName', e.target.value)}
                          placeholder="e.g., Beef Striploin"
                          className="w-full px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-theme-muted flex items-center gap-1 mb-1">
                          <Hash className="w-3 h-3" />
                          Batch/Lot Number
                        </label>
                        <input
                          type="text"
                          value={label.batchNumber}
                          onChange={(e) => updateLabel(label.id, 'batchNumber', e.target.value)}
                          placeholder="e.g., LOT-2026-001"
                          className="w-full px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-theme-muted flex items-center gap-1 mb-1">
                          <Calendar className="w-3 h-3" />
                          Use By Date
                        </label>
                        <input
                          type="date"
                          value={label.useByDate}
                          onChange={(e) => updateLabel(label.id, 'useByDate', e.target.value)}
                          className="w-full px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-rose-500"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-theme-muted flex items-center gap-1 mb-1">
                          <Tag className="w-3 h-3" />
                          Supplier Code
                        </label>
                        <input
                          type="text"
                          value={label.supplierCode}
                          onChange={(e) => updateLabel(label.id, 'supplierCode', e.target.value)}
                          placeholder="e.g., SUP-123"
                          className="w-full px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      onClick={() => removeLabel(label.id)}
                      className="p-2 h-fit text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={() => labelCameraRef.current?.click()}
                className="w-full py-2 bg-rose-500/20 text-rose-500 rounded-lg text-sm font-medium hover:bg-rose-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Another Label
              </button>
            </div>
          )}

          {proteinLabels.length === 0 && !isCapturingLabel && (
            <div className="text-center py-6 text-theme-muted">
              <Beef className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No protein labels captured yet</p>
              <p className="text-xs">Optional: Add labels for meat, poultry, or seafood traceability</p>
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
            {(['ambient', 'chilled', 'frozen'] as TempCategory[]).map(cat => {
              const config = TEMP_CATEGORIES[cat]
              const Icon = config.icon
              const count = getItemsByCategory(cat).length
              const tempField = `${cat}Temp` as 'ambientTemp' | 'chilledTemp' | 'frozenTemp'

              return (
                <div
                  key={cat}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all",
                    count > 0
                      ? `border-${cat === 'ambient' ? 'amber' : cat === 'chilled' ? 'cyan' : 'blue'}-500/50 ${config.bgColor}`
                      : "border-theme-primary bg-theme-secondary opacity-50"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-5 h-5 ${config.color}`} />
                    <span className={`font-semibold ${config.color}`}>{config.label}</span>
                    <span className={`text-xs ${config.bgColor} ${config.color} px-2 py-0.5 rounded-full ml-auto`}>
                      {count} items
                    </span>
                  </div>
                  <p className="text-xs text-theme-muted mb-2">{config.range}</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={receipt[tempField]}
                      onChange={(e) => updateField(tempField, e.target.value)}
                      placeholder="°C"
                      disabled={count === 0}
                      className="flex-1 px-3 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => applyGroupTemp(cat, receipt[tempField])}
                      disabled={!receipt[tempField] || count === 0}
                      className={cn(
                        "px-3 py-2 text-white rounded-lg text-sm font-medium disabled:opacity-50",
                        cat === 'ambient' ? 'bg-amber-500' :
                          cat === 'chilled' ? 'bg-cyan-500' : 'bg-blue-500'
                      )}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              )
            })}
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

          <div className="flex flex-wrap gap-2 mb-4">
            {(['ambient', 'chilled', 'frozen'] as TempCategory[]).map(cat => {
              const config = TEMP_CATEGORIES[cat]
              const Icon = config.icon
              return (
                <button
                  key={cat}
                  onClick={() => addItem(cat)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    config.bgColor, config.color,
                    `hover:${config.bgColor.replace('/10', '/20')}`
                  )}
                >
                  <Plus className="w-4 h-4" />
                  <Icon className="w-4 h-4" />
                  {config.label}
                </button>
              )
            })}
          </div>

          {receipt.items.length === 0 ? (
            <div className="text-center py-8 text-theme-muted">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No items added yet</p>
              <p className="text-sm">Scan a delivery note or add items manually</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
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

        {/* Summary before submit */}
        {(scannedPages.length > 0 || proteinLabels.length > 0) && (
          <div className="bg-emerald-500/10 rounded-xl p-4 flex items-center gap-4 text-sm border border-emerald-500/30">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-500" />
              <span className="text-theme-primary font-medium">{scannedPages.length} delivery note page(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-rose-500" />
              <span className="text-theme-primary font-medium">{proteinLabels.length} protein label(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-500" />
              <span className="text-theme-primary font-medium">{receipt.items.length} item(s)</span>
            </div>
          </div>
        )}

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
                {submitProgress || 'Saving...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Record Receipt
                {(scannedPages.length > 0 || proteinLabels.length > 0) && (
                  <span className="text-sm font-normal opacity-80">
                    ({scannedPages.length + proteinLabels.length} images)
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
