import { useState, useMemo } from 'react'
import {
  ListFilter,
  Package,
  Calendar,
  User,
  AlertTriangle,
  Search,
  CheckCircle,
  XCircle,
  Download,
  ShieldCheck,
  Zap,
  FileText,
  BarChart3,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/store/useAppStore'
import {
  listGoodsReceipts,
  type ReceiptStatus,
  getImagePublicUrl,
  type DeliveryImage,
  type GoodsReceipt,
  getGoodsReceiptWithDetails,
} from '@/services/deliveryService'
import {
  generateGoodsReceiptReport,
  generateSummaryReport,
  downloadPdfReport,
} from '@/services/pdfReportService'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { GlassCard } from '@/components/ui/GlassCard'
import { Separator } from '@/components/ui/Separator'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog'
import { ScrollArea } from '@/components/ui/ScrollArea'

// --- Types & Constants ---

interface FilterState {
  status: ReceiptStatus | 'all'
  search: string
  startDate: string
  endDate: string
}

const DEFAULT_FILTERS: FilterState = {
  status: 'all',
  search: '',
  startDate: '',
  endDate: '',
}

const STATUS_MAP: Record<ReceiptStatus, { icon: React.ReactNode; color: string; label: string }> = {
  completed: { icon: <CheckCircle className="h-4 w-4" />, color: 'bg-emerald-500/10 text-emerald-600', label: 'Concluído' },
  draft: { icon: <Zap className="h-4 w-4" />, color: 'bg-yellow-500/10 text-yellow-600', label: 'Rascunho' },
  flagged: { icon: <AlertTriangle className="h-4 w-4" />, color: 'bg-red-500/10 text-red-600', label: 'Sinalizado' },
  voided: { icon: <XCircle className="h-4 w-4" />, color: 'bg-gray-500/10 text-gray-600', label: 'Anulado' },
}

// --- Components ---

interface ReceiptCardProps {
  receipt: GoodsReceipt
  onClick: (receipt: GoodsReceipt) => void
}

function ReceiptCard({ receipt, onClick }: ReceiptCardProps) {
  const status = STATUS_MAP[receipt.status as ReceiptStatus] || STATUS_MAP.completed
  
  const createdAtDate = useMemo(() => {
    return new Date(receipt.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  }, [receipt.createdAt])

  return (
    <Card
      className="p-4 cursor-pointer hover:bg-theme-secondary transition-colors border-l-4"
      style={{ borderLeftColor: status.color.split('/')[0].split('-')[1] === 'gray' ? undefined : status.color.split('/')[0].split('-')[1] + '-500' }}
      onClick={() => onClick(receipt)}
    >
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <Badge className={cn('w-fit font-medium', status.color)}>
            {status.icon}
            {status.label}
          </Badge>
          <h3 className="text-lg font-semibold text-theme-primary">
            {receipt.supplierName}
          </h3>
          <p className="text-sm text-theme-muted">
            {receipt.invoiceNumber && `NF: ${receipt.invoiceNumber} | `}
            Recebido por <strong>{receipt.receivedByName}</strong>
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-theme-muted">{createdAtDate}</p>
          <p className="text-xl font-bold text-theme-primary mt-1">
            {receipt.overallTemperature?.toFixed(1) ?? '--'}°C
          </p>
          {receipt.temperatureCompliant ? (
            <CheckCircle className="h-5 w-5 text-emerald-500 ml-auto" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-red-500 ml-auto" />
          )}
        </div>
      </div>
    </Card>
  )
}

interface ImageGridProps {
  images: DeliveryImage[]
}

function ImageGrid({ images }: ImageGridProps) {
  const [selectedImage, setSelectedImage] = useState<DeliveryImage | null>(null)

  const openImageInModal = (image: DeliveryImage) => {
    setSelectedImage(image)
  }

  const ImageTypeLabel: Record<DeliveryImage['imageType'], string> = {
    delivery_note: 'Nota Fiscal / Romaneio',
    protein_label: 'Rótulo de Rastreabilidade',
    temperature_log: 'Registro de Temperatura',
    other: 'Outros',
  }

  return (
    <div className="mt-4">
      <h4 className="flex items-center gap-2 text-md font-semibold text-theme-primary mb-3">
        <ShieldCheck className="w-5 h-5 text-theme-muted" />
        Documentação (Audit-Safe)
      </h4>
      {images.length === 0 ? (
        <p className="text-sm text-theme-muted italic">Nenhuma imagem registrada para esta entrega.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map(image => (
            <div
              key={image.id}
              className="relative aspect-square cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-all group"
              onClick={() => openImageInModal(image)}
            >
              <img
                src={getImagePublicUrl(image.storagePath)}
                alt={ImageTypeLabel[image.imageType]}
                className="w-full h-full object-cover transition-opacity duration-300 group-hover:opacity-80"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent flex items-end p-2">
                <p className="text-xs font-medium text-white">
                  {ImageTypeLabel[image.imageType]} {image.pageNumber > 1 ? `(Pág ${image.pageNumber})` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal for Full View */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 bg-theme-card border-none">
          {selectedImage && (
            <>
              <DialogHeader className="p-4 border-b border-theme-border">
                <DialogTitle className="text-xl font-bold">
                  {ImageTypeLabel[selectedImage.imageType]}
                </DialogTitle>
                <div className="text-sm text-theme-muted">
                    Salvo em: {new Date(selectedImage.createdAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </DialogHeader>
              <ScrollArea className="flex-1 p-4">
                <div className="flex justify-center mb-4">
                  <img
                    src={getImagePublicUrl(selectedImage.storagePath)}
                    alt={ImageTypeLabel[selectedImage.imageType]}
                    className="max-h-[70vh] w-auto object-contain"
                  />
                </div>
                {selectedImage.imageType === 'protein_label' && (
                  <Card className="mt-4 p-4 border border-theme-border">
                    <h5 className="font-semibold text-theme-primary mb-2">Dados de Rastreabilidade</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <p><strong>Produto:</strong> {selectedImage.productName || 'N/A'}</p>
                      <p><strong>Cód. Fornecedor:</strong> {selectedImage.supplierCode || 'N/A'}</p>
                      <p><strong>Lote/Batch:</strong> {selectedImage.batchNumber || 'N/A'}</p>
                      <p><strong>Usar Até:</strong> {selectedImage.useByDate || 'N/A'}</p>
                      <p><strong>Descrição:</strong> {selectedImage.description || 'N/A'}</p>
                    </div>
                  </Card>
                )}
                {selectedImage.ocrText && (
                  <Card className="mt-4 p-4 border border-theme-border">
                    <h5 className="font-semibold text-theme-primary mb-2">Texto Extraído (OCR)</h5>
                    <p className="text-sm whitespace-pre-wrap font-mono text-theme-muted/80">{selectedImage.ocrText}</p>
                  </Card>
                )}
              </ScrollArea>
              <div className="p-4 border-t border-theme-border flex justify-end">
                <Button variant="outline" onClick={() => setSelectedImage(null)}>
                    Fechar
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface ReceiptDetailModalProps {
  receipt: GoodsReceipt | null
  onClose: () => void
}

function ReceiptDetailModal({ receipt, onClose }: ReceiptDetailModalProps) {
  const [images, setImages] = useState<DeliveryImage[]>([])
  
  const { data: details, isLoading: isLoadingDetails } = useQuery({
    queryKey: ['receiptDetails', receipt?.id],
    queryFn: () => {
      if (!receipt?.id) return null
      return getGoodsReceiptWithDetails(receipt.id)
    },
    enabled: !!receipt,
  })

  // Update images when details load
  useMemo(() => {
    if (details?.images) {
      setImages(details.images)
    }
  }, [details])

  if (!receipt) return null

  const items = details?.items || []

  const handleDownloadSinglePdf = async () => {
    if (!details) return
    
    try {
      toast.loading('Gerando PDF do recebimento...')
      const blob = await generateGoodsReceiptReport(
        [{ ...receipt, items: items as any[], images }],
        {
          siteName: 'Estabelecimento',
          generatedBy: 'Sistema ChefVoice',
        }
      )
      downloadPdfReport(blob, `recebimento_${receipt.supplierName}_${new Date(receipt.createdAt).toISOString().split('T')[0]}.pdf`)
      toast.dismiss()
      toast.success('PDF gerado com sucesso!')
    } catch (error) {
      toast.dismiss()
      toast.error('Erro ao gerar PDF')
      console.error(error)
    }
  }

  return (
    <Dialog open={!!receipt} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[95vh] p-0 bg-theme-card border-none">
        <DialogHeader className="p-6 border-b border-theme-border">
          <DialogTitle className="text-2xl font-bold flex items-center gap-3">
            <Package className="h-6 w-6 text-theme-primary" />
            Detalhes do Recebimento: {receipt.supplierName}
          </DialogTitle>
          <div className="text-sm text-theme-muted flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(receipt.receivedAt).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              Recebido por: {receipt.receivedByName}
            </span>
            <Badge className={cn('w-fit font-medium border', STATUS_MAP[receipt.status as ReceiptStatus].color)}>
                {STATUS_MAP[receipt.status as ReceiptStatus].label}
            </Badge>
          </div>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Summary */}
            <div className="lg:col-span-1">
              <h3 className="text-xl font-semibold mb-3 text-theme-primary">Sumário da Entrega</h3>
              <div className="audo-safe-fields space-y-3 p-4 bg-theme-secondary rounded-lg border border-theme-border">
                <p className="text-sm"><strong>ID do Recebimento:</strong> {receipt.id}</p>
                <p className="text-sm"><strong>Criado em:</strong> {new Date(receipt.createdAt).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'long' })}</p>
                <p className="text-sm"><strong>Fornecedor:</strong> {receipt.supplierName}</p>
                <p className="text-sm"><strong>NF/Romaneio:</strong> {receipt.invoiceNumber || 'N/A'}</p>
                <p className="text-sm"><strong>Data da NF:</strong> {receipt.invoiceDate || 'N/A'}</p>
                <p className="text-sm"><strong>Temperatura Média:</strong> {receipt.overallTemperature?.toFixed(1) ?? 'N/A'}°C</p>
                <p className="text-sm"><strong>Status de Conformidade:</strong> {receipt.temperatureCompliant ? 'Conforme' : 'Não Conforme'} </p>
                <Separator />
                <p className="text-sm whitespace-pre-wrap"><strong>Notas:</strong> {receipt.notes || 'N/A'}</p>
                <p className="text-xs text-theme-muted mt-4">Os campos auditáveis (ID, Criado em, Recebido por) são imutáveis após o status 'completed'.</p>
              </div>
              
              <ImageGrid images={images} />
            </div>

            {/* Right Column: Items and OCR */}
            <div className="lg:col-span-2">
              <h3 className="text-xl font-semibold mb-3 text-theme-primary">Itens Recebidos</h3>
              <div className="space-y-4">
                {isLoadingDetails ? (
                  <p className="text-theme-muted">Carregando detalhes dos itens...</p>
                ) : items.length === 0 ? (
                  <p className="text-theme-muted italic">Nenhum item registrado para esta entrega.</p>
                ) : (
                  items.map((item, index) => (
                    <Card key={(item as any).id || index} className="p-4 flex justify-between items-center">
                      <div>
                        <p className="font-medium text-theme-primary">{(item as any).item_name}</p>
                        <p className="text-sm text-theme-muted">
                          {(item as any).quantity} {(item as any).unit} | Temp: {(item as any).temperature?.toFixed(1) ?? '--'}°C
                        </p>
                        <Badge className={cn(
                            'mt-1 w-fit',
                            (item as any).temperature_compliant ? STATUS_MAP.completed.color : STATUS_MAP.flagged.color
                        )}>
                            {(item as any).temperature_compliant ? 'Temp. OK' : 'Temp. Problema'}
                        </Badge>
                      </div>
                      <div className="text-sm text-right">
                        <Badge variant="secondary">{(item as any).category}</Badge>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {receipt.ocrRawText && (
                <div className="mt-6">
                  <h3 className="text-xl font-semibold mb-3 text-theme-primary">Dados de OCR (Texto Bruto)</h3>
                  <Card className="p-4 bg-theme-secondary border border-theme-border">
                    <p className="text-sm whitespace-pre-wrap font-mono text-theme-muted/80">{receipt.ocrRawText}</p>
                    <p className="text-xs text-right text-theme-muted mt-2">Confiança: {receipt.ocrConfidence?.toFixed(2) ?? 'N/A'}</p>
                  </Card>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <div className="p-4 border-t border-theme-border flex justify-between">
          <Button variant="outline" className="flex items-center gap-2" onClick={handleDownloadSinglePdf}>
            <Download className="h-4 w-4" />
            Baixar PDF
          </Button>
          <Button onClick={onClose}>
            Fechar Detalhes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- PDF Report Dialog ---

interface ReportDialogProps {
  isOpen: boolean
  onClose: () => void
  receipts: GoodsReceipt[]
  filters: FilterState
}

function ReportDialog({ isOpen, onClose, receipts, filters }: ReportDialogProps) {
  const { currentSite } = useAppStore()
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportType, setReportType] = useState<'detailed' | 'summary'>('detailed')

  const handleGenerateReport = async () => {
    if (receipts.length === 0) {
      toast.error('Nenhum recebimento para gerar relatório')
      return
    }

    setIsGenerating(true)
    toast.loading('Gerando relatório PDF...')

    try {
      // Fetch full details for all receipts if generating detailed report
      let receiptsWithDetails = receipts
      
      if (reportType === 'detailed') {
        const detailsPromises = receipts.map(r => getGoodsReceiptWithDetails(r.id))
        const details = await Promise.all(detailsPromises)
        receiptsWithDetails = details
          .filter((d): d is NonNullable<typeof d> => d !== null)
          .map(d => ({
            ...d.receipt,
            items: d.items as any[],
            images: d.images,
          }))
      }

      const options = {
        siteName: currentSite?.name || 'Estabelecimento',
        siteAddress: currentSite?.address,
        generatedBy: 'ChefVoice Kitchen Compliance',
        filters: {
          status: filters.status !== 'all' ? filters.status : undefined,
          search: filters.search || undefined,
          startDate: filters.startDate || undefined,
          endDate: filters.endDate || undefined,
        },
      }

      let blob: Blob
      if (reportType === 'summary') {
        blob = generateSummaryReport(receiptsWithDetails as any, options)
      } else {
        blob = await generateGoodsReceiptReport(receiptsWithDetails as any, options)
      }

      const filename = `relatorio_recebimentos_${new Date().toISOString().split('T')[0]}.pdf`
      downloadPdfReport(blob, filename)

      toast.dismiss()
      toast.success('Relatório gerado com sucesso!')
      onClose()
    } catch (error) {
      toast.dismiss()
      toast.error('Erro ao gerar relatório')
      console.error(error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerar Relatório PDF
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Report Type Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-theme-primary">Tipo de Relatório</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setReportType('detailed')}
                className={cn(
                  'p-4 rounded-lg border-2 text-left transition-all',
                  reportType === 'detailed'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                )}
              >
                <FileText className="h-6 w-6 mb-2 text-emerald-600" />
                <p className="font-medium text-sm">Detalhado</p>
                <p className="text-xs text-theme-muted mt-1">
                  Todos os detalhes, itens e imagens de cada recebimento
                </p>
              </button>
              
              <button
                onClick={() => setReportType('summary')}
                className={cn(
                  'p-4 rounded-lg border-2 text-left transition-all',
                  reportType === 'summary'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300'
                )}
              >
                <BarChart3 className="h-6 w-6 mb-2 text-emerald-600" />
                <p className="font-medium text-sm">Resumido</p>
                <p className="text-xs text-theme-muted mt-1">
                  Visão geral em uma página com estatísticas
                </p>
              </button>
            </div>
          </div>

          {/* Receipt Count Info */}
          <div className="p-4 bg-theme-secondary rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-theme-muted">Recebimentos incluídos:</span>
              <span className="font-semibold text-theme-primary">{receipts.length}</span>
            </div>
            {filters.status !== 'all' && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-theme-muted">Status filtrado:</span>
                <span className="font-medium text-theme-primary">
                  {STATUS_MAP[filters.status as ReceiptStatus]?.label || filters.status}
                </span>
              </div>
            )}
            {filters.search && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-theme-muted">Busca:</span>
                <span className="font-medium text-theme-primary">"{filters.search}"</span>
              </div>
            )}
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 text-sm text-theme-muted">
            <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>
              O relatório inclui todos os dados auditáveis e pode ser usado para conformidade HACCP.
              As imagens são referenciadas no relatório detalhado.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button onClick={handleGenerateReport} disabled={isGenerating || receipts.length === 0}>
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar PDF
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// --- Main Screen ---

interface ReceiptHistoryScreenProps {
  onBack?: () => void
  onNavigate?: (screen: string) => void
}

export function ReceiptHistoryScreen({ onBack, onNavigate }: ReceiptHistoryScreenProps) {
  const { currentSite } = useAppStore()
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [page, setPage] = useState(0)
  const [selectedReceipt, setSelectedReceipt] = useState<GoodsReceipt | null>(null)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
  const limit = 10

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPage(0)
  }

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['listGoodsReceipts', currentSite?.id, filters, page],
    queryFn: () => {
      if (!currentSite?.id) return { receipts: [], total: 0 }
      return listGoodsReceipts(currentSite.id, {
        limit: limit,
        offset: page * limit,
        status: filters.status === 'all' ? undefined : (filters.status as ReceiptStatus),
      })
    },
    enabled: !!currentSite?.id,
  })

  const receipts = data?.receipts || []
  const totalCount = data?.total || 0
  const totalPages = Math.ceil(totalCount / limit)

  const filteredReceipts = useMemo(() => {
    if (!filters.search) return receipts
    
    const searchLower = filters.search.toLowerCase()
    
    return receipts.filter(receipt => 
      receipt.supplierName.toLowerCase().includes(searchLower) ||
      receipt.invoiceNumber?.toLowerCase().includes(searchLower) ||
      receipt.receivedByName.toLowerCase().includes(searchLower)
    )
  }, [receipts, filters.search])

  const openModal = (receipt: GoodsReceipt) => {
    setSelectedReceipt(receipt)
  }

  const closeModal = () => {
    setSelectedReceipt(null)
  }

  const handleNewReceipt = () => {
    onNavigate?.('goods_receipt')
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-3xl font-bold text-theme-primary flex items-center gap-3">
            <ListFilter className="w-7 h-7" />
            Histórico de Recebimentos
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsReportDialogOpen(true)} className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatório PDF
          </Button>
          <Button onClick={handleNewReceipt}>
            Novo Recebimento
          </Button>
        </div>
      </header>

      <div className="mb-6">
        <GlassCard className="p-4 flex flex-wrap gap-4 items-center">
          <h2 className="text-lg font-semibold text-theme-primary flex items-center gap-2">
            <Search className="w-5 h-5" />
            Filtros
          </h2>

          <div className="flex-1 min-w-[200px] relative">
            <Input 
              placeholder="Buscar Fornecedor, NF, ou Recebedor..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted" />
          </div>

          <div className="w-[180px]">
            <Select 
              value={filters.status} 
              onValueChange={(value: string) => handleFilterChange('status', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                {Object.keys(STATUS_MAP).map(statusKey => (
                  <SelectItem key={statusKey} value={statusKey}>
                    {STATUS_MAP[statusKey as ReceiptStatus].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            variant="outline"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            Limpar Filtros
          </Button>

        </GlassCard>
      </div>

      <div className="space-y-4">
        {isLoading || isFetching ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <span className="ml-3 text-theme-muted">Carregando histórico...</span>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-theme-muted mx-auto mb-4" />
            <p className="text-theme-muted">Nenhum recebimento encontrado.</p>
            <p className="text-sm text-theme-muted mt-1">Comece a registrar novas entregas!</p>
          </div>
        ) : (
          filteredReceipts.map(receipt => (
            <ReceiptCard key={receipt.id} receipt={receipt} onClick={openModal} />
          ))
        )}
      </div>

      {/* Pagination */}
      {filteredReceipts.length > 0 && (
        <div className="flex justify-between items-center mt-6">
          <p className="text-sm text-theme-muted">
            Mostrando {filteredReceipts.length} de {totalCount} registros.
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => Math.max(0, prev - 1))}
              disabled={page === 0 || isLoading || isFetching}
            >
              Anterior
            </Button>
            <span className="text-sm font-medium text-theme-primary">
              Página {page + 1} de {totalPages || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(prev => prev + 1)}
              disabled={page >= totalPages - 1 || isLoading || isFetching || totalCount === 0}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}

      <ReceiptDetailModal receipt={selectedReceipt} onClose={closeModal} />
      
      <ReportDialog 
        isOpen={isReportDialogOpen} 
        onClose={() => setIsReportDialogOpen(false)}
        receipts={filteredReceipts}
        filters={filters}
      />
    </div>
  )
}
