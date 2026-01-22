import { useState, useRef } from 'react'
import { 
  ArrowLeft, Camera, Upload, Scan, Package, Thermometer, 
  User, Building2, Calendar, CheckCircle, X, Loader2,
  Plus, Trash2, FileText, AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/useAppStore'
import { toast } from 'sonner'
import { processInvoiceImage } from '@/services/ocrService'

interface GoodsReceiptScreenProps {
  onBack: () => void
}

interface ReceiptItem {
  id: string
  name: string
  quantity: string
  unit: string
  temperature?: string
}

interface ReceiptData {
  supplier: string
  invoiceNumber: string
  invoiceDate: string
  items: ReceiptItem[]
  receivedBy: string
  receivedAt: string
  overallTemperature: string
  notes: string
  imageUrl?: string
}

const INITIAL_RECEIPT: ReceiptData = {
  supplier: '',
  invoiceNumber: '',
  invoiceDate: new Date().toISOString().split('T')[0],
  items: [],
  receivedBy: '',
  receivedAt: new Date().toISOString().slice(0, 16),
  overallTemperature: '',
  notes: '',
}

export function GoodsReceiptScreen({ onBack }: GoodsReceiptScreenProps) {
  const { staffMembers, settings } = useAppStore()
  const [receipt, setReceipt] = useState<ReceiptData>(INITIAL_RECEIPT)
  const [isScanning, setIsScanning] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [scannedImage, setScannedImage] = useState<string | null>(null)
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsScanning(true)
    
    try {
      // Convert to base64 for preview
      const reader = new FileReader()
      reader.onload = async (event) => {
        const imageData = event.target?.result as string
        setScannedImage(imageData)
        
        // Process with OCR
        const ocrResult = await processInvoiceImage(file)
        
        if (ocrResult) {
          setReceipt(prev => ({
            ...prev,
            supplier: ocrResult.supplier || prev.supplier,
            invoiceNumber: ocrResult.invoiceNumber || prev.invoiceNumber,
            invoiceDate: ocrResult.invoiceDate || prev.invoiceDate,
            items: ocrResult.items.length > 0 ? ocrResult.items : prev.items,
          }))
          setOcrConfidence(ocrResult.confidence)
          
          if (ocrResult.confidence > 70) {
            toast.success(`Invoice scanned! ${ocrResult.items.length} items detected.`)
          } else {
            toast.info('Invoice scanned with low confidence. Please verify extracted data.')
          }
        }
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error('OCR error:', error)
      toast.error('Failed to scan invoice. Please enter details manually.')
    } finally {
      setIsScanning(false)
    }
  }

  // Update receipt field
  const updateField = (field: keyof ReceiptData, value: string) => {
    setReceipt(prev => ({ ...prev, [field]: value }))
  }

  // Add new item
  const addItem = () => {
    const newItem: ReceiptItem = {
      id: crypto.randomUUID(),
      name: '',
      quantity: '',
      unit: 'kg',
      temperature: '',
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
      
      toast.success('Goods receipt recorded successfully!')
      
      // Reset form
      setReceipt(INITIAL_RECEIPT)
      setScannedImage(null)
      setOcrConfidence(null)
      
    } catch (error) {
      console.error('Submit error:', error)
      toast.error('Failed to save receipt')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check temperature compliance
  const isTempCompliant = (temp: string) => {
    const tempNum = parseFloat(temp)
    if (isNaN(tempNum)) return null
    // Chilled goods should be ≤5°C, frozen ≤-18°C
    return tempNum <= 5
  }

  return (
    <div className="min-h-screen bg-theme-primary">
      {/* Header */}
      <div className="bg-theme-card border-b border-theme-primary px-4 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-xl hover:bg-theme-secondary transition-colors text-theme-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2 text-theme-primary">
              <Package className="w-6 h-6 text-emerald-500" />
              Goods Receipt
            </h1>
            <p className="text-sm text-theme-muted">
              Scan invoice & record delivery
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Invoice Scanner Section */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-primary">
            <Scan className="w-5 h-5 text-cyan-500" />
            Scan Invoice
          </h2>

          {!scannedImage ? (
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
                <span className="text-sm text-theme-muted">Use camera to scan invoice</span>
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
                <span className="font-medium text-theme-primary">Upload File</span>
                <span className="text-sm text-theme-muted">Select image from device</span>
              </button>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Scanned image preview */}
              <div className="relative">
                <img
                  src={scannedImage}
                  alt="Scanned invoice"
                  className="w-full max-h-64 object-contain rounded-xl bg-black/20"
                />
                <button
                  onClick={() => {
                    setScannedImage(null)
                    setOcrConfidence(null)
                  }}
                  className="absolute top-2 right-2 p-2 bg-black/50 rounded-lg hover:bg-black/70 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* OCR confidence indicator */}
              {ocrConfidence !== null && (
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
                    OCR Confidence: {ocrConfidence.toFixed(0)}%
                    {ocrConfidence <= 70 && ' - Please verify extracted data'}
                  </span>
                </div>
              )}

              {/* Rescan button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2 bg-theme-secondary rounded-lg text-sm hover:bg-theme-ghost transition-colors text-theme-primary"
              >
                Scan Different Invoice
              </button>
            </div>
          )}

          {isScanning && (
            <div className="mt-4 flex items-center justify-center gap-3 py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
              <span className="text-theme-muted">Processing invoice...</span>
            </div>
          )}
        </div>

        {/* Supplier & Invoice Info */}
        <div className="bg-theme-card rounded-2xl border border-theme-primary p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-theme-primary">
            <Building2 className="w-5 h-5 text-purple-500" />
            Supplier Details
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
              <label className="text-sm text-theme-muted block mb-1.5">Invoice Number</label>
              <input
                type="text"
                value={receipt.invoiceNumber}
                onChange={(e) => updateField('invoiceNumber', e.target.value)}
                placeholder="e.g., INV-2026-001234"
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-sm text-theme-muted block mb-1.5">Invoice Date</label>
              <input
                type="date"
                value={receipt.invoiceDate}
                onChange={(e) => updateField('invoiceDate', e.target.value)}
                className="w-full px-4 py-3 bg-theme-secondary border border-theme-primary rounded-xl text-theme-primary focus:outline-none focus:border-emerald-500 transition-colors"
              />
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
            <button
              onClick={addItem}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>

          {receipt.items.length === 0 ? (
            <div className="text-center py-8 text-theme-muted">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No items added yet</p>
              <p className="text-sm">Scan an invoice or add items manually</p>
            </div>
          ) : (
            <div className="space-y-3">
              {receipt.items.map((item, idx) => (
                <div 
                  key={item.id}
                  className="p-4 bg-theme-secondary rounded-xl border border-theme-primary"
                >
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center text-sm font-bold flex-shrink-0 mt-2">
                      {idx + 1}
                    </span>
                    
                    <div className="flex-1 grid sm:grid-cols-4 gap-3">
                      <div className="sm:col-span-2">
                        <label className="text-xs text-theme-muted block mb-1">Item Name *</label>
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
                        <div className="flex gap-2">
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
                            className="w-20 px-2 py-2 bg-theme-card border border-theme-primary rounded-lg text-sm text-theme-primary focus:outline-none focus:border-emerald-500"
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
                        <label className="text-xs text-theme-muted block mb-1">Temp (°C)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={item.temperature || ''}
                            onChange={(e) => updateItem(item.id, 'temperature', e.target.value)}
                            placeholder="3.5"
                            className={cn(
                              "w-full px-3 py-2 bg-theme-card border rounded-lg text-sm text-theme-primary focus:outline-none",
                              item.temperature && isTempCompliant(item.temperature) === false
                                ? "border-red-500 text-red-400"
                                : "border-theme-primary focus:border-emerald-500"
                            )}
                          />
                          {item.temperature && isTempCompliant(item.temperature) !== null && (
                            <div className={cn(
                              "absolute right-2 top-1/2 -translate-y-1/2",
                              isTempCompliant(item.temperature) ? "text-emerald-500" : "text-red-500"
                            )}>
                              {isTempCompliant(item.temperature) ? (
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
              ))}
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

            <div>
              <label className="text-sm text-theme-muted block mb-1.5 flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-cyan-500" />
                Overall Temperature (°C)
              </label>
              <input
                type="text"
                value={receipt.overallTemperature}
                onChange={(e) => updateField('overallTemperature', e.target.value)}
                placeholder="e.g., 3.5"
                className={cn(
                  "w-full px-4 py-3 bg-theme-secondary border rounded-xl text-theme-primary placeholder:text-theme-muted focus:outline-none transition-colors",
                  receipt.overallTemperature && isTempCompliant(receipt.overallTemperature) === false
                    ? "border-red-500"
                    : "border-theme-primary focus:border-emerald-500"
                )}
              />
              {receipt.overallTemperature && isTempCompliant(receipt.overallTemperature) === false && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Temperature exceeds safe limit (5°C for chilled goods)
                </p>
              )}
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
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
