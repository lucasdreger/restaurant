/**
 * PDF Report Service
 * Generates professional PDF reports for Goods Receipts
 */

import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { GoodsReceipt, DeliveryImage } from './deliveryService'

// Types for report generation
interface ReceiptWithDetails extends GoodsReceipt {
  items: Array<{
    id?: string
    item_name: string
    quantity: number
    unit: string
    temperature?: number
    temperature_compliant?: boolean
    category?: string
    notes?: string
  }>
  images: DeliveryImage[]
}

interface ReportFilters {
  startDate?: string
  endDate?: string
  status?: string
  search?: string
}

interface GenerateReportOptions {
  siteName: string
  siteAddress?: string
  generatedBy: string
  filters?: ReportFilters
  includeImages?: boolean
}

// Status translations for Portuguese
const STATUS_LABELS: Record<string, string> = {
  completed: 'Concluído',
  draft: 'Rascunho',
  flagged: 'Sinalizado',
  voided: 'Anulado',
}

// Category translations
const CATEGORY_LABELS: Record<string, string> = {
  chilled: 'Resfriado',
  frozen: 'Congelado',
  ambient: 'Ambiente',
  dry: 'Seco',
  produce: 'Hortifruti',
  meat: 'Carnes',
  dairy: 'Laticínios',
  seafood: 'Frutos do Mar',
}

/**
 * Generate a comprehensive PDF report of goods receipts
 */
export async function generateGoodsReceiptReport(
  receipts: ReceiptWithDetails[],
  options: GenerateReportOptions
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.width
  const pageHeight = doc.internal.pageSize.height
  const margin = 15

  // Helper function to add header to each page
  const addHeader = (pageNum: number, totalPages: number) => {
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`ChefVoice Kitchen Compliance - Relatório de Recebimentos`, margin, 10)
    doc.text(`Página ${pageNum} de ${totalPages}`, pageWidth - margin - 30, 10)
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, 12, pageWidth - margin, 12)
  }

  // Helper function to add footer
  const addFooter = () => {
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    const footerText = `Relatório gerado em: ${new Date().toLocaleString('pt-BR')} por ${options.generatedBy}`
    doc.text(footerText, margin, pageHeight - 10)
    doc.text('Documento para fins de auditoria HACCP', pageWidth - margin - 60, pageHeight - 10)
  }

  // Cover Page
  doc.setFontSize(24)
  doc.setTextColor(0, 100, 80)
  doc.text('Relatório de Recebimentos', margin, 40)

  doc.setFontSize(14)
  doc.setTextColor(60, 60, 60)
  doc.text(`Estabelecimento: ${options.siteName}`, margin, 55)
  if (options.siteAddress) {
    doc.setFontSize(11)
    doc.text(`Endereço: ${options.siteAddress}`, margin, 62)
  }

  // Summary box
  doc.setFillColor(240, 248, 245)
  doc.roundedRect(margin, 70, pageWidth - margin * 2, 50, 3, 3, 'F')

  doc.setFontSize(12)
  doc.setTextColor(0, 100, 80)
  doc.text('Resumo do Relatório', margin + 5, 80)

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Total de Recebimentos: ${receipts.length}`, margin + 5, 88)
  
  const compliantCount = receipts.filter(r => r.temperatureCompliant).length
  const nonCompliantCount = receipts.length - compliantCount
  
  doc.text(`Recebimentos Conformes: ${compliantCount}`, margin + 5, 94)
  doc.text(`Recebimentos Não Conformes: ${nonCompliantCount}`, margin + 5, 100)
  
  const totalItems = receipts.reduce((sum, r) => sum + (r.items?.length || 0), 0)
  doc.text(`Total de Itens Recebidos: ${totalItems}`, margin + 5, 106)
  
  const totalImages = receipts.reduce((sum, r) => sum + (r.images?.length || 0), 0)
  doc.text(`Total de Imagens Anexadas: ${totalImages}`, margin + 5, 112)

  // Filters info
  if (options.filters) {
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    let filterY = 130
    doc.text('Filtros Aplicados:', margin, filterY)
    filterY += 6
    
    if (options.filters.startDate) {
      doc.text(`- Data Inicial: ${options.filters.startDate}`, margin + 5, filterY)
      filterY += 5
    }
    if (options.filters.endDate) {
      doc.text(`- Data Final: ${options.filters.endDate}`, margin + 5, filterY)
      filterY += 5
    }
    if (options.filters.status && options.filters.status !== 'all') {
      doc.text(`- Status: ${STATUS_LABELS[options.filters.status] || options.filters.status}`, margin + 5, filterY)
      filterY += 5
    }
    if (options.filters.search) {
      doc.text(`- Busca: "${options.filters.search}"`, margin + 5, filterY)
    }
  }

  addFooter()

  // Receipt Details Pages
  for (let i = 0; i < receipts.length; i++) {
    const receipt = receipts[i]
    doc.addPage()
    addHeader(i + 2, receipts.length + 1)

    let yPos = 25

    // Receipt header
    doc.setFontSize(16)
    doc.setTextColor(0, 100, 80)
    doc.text(`Recebimento #${i + 1}`, margin, yPos)
    yPos += 8

    // Status badge
    const statusColor = receipt.status === 'completed' ? [0, 150, 100] : 
                       receipt.status === 'flagged' ? [200, 50, 50] : 
                       receipt.status === 'voided' ? [100, 100, 100] : [255, 150, 0]
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
    doc.roundedRect(margin, yPos - 4, 40, 8, 2, 2, 'F')
    doc.setFontSize(9)
    doc.setTextColor(255, 255, 255)
    doc.text(STATUS_LABELS[receipt.status] || receipt.status, margin + 2, yPos + 1)
    yPos += 12

    // Receipt info table
    doc.setFontSize(10)
    doc.setTextColor(60, 60, 60)

    const infoData = [
      ['Fornecedor:', receipt.supplierName],
      ['Data de Recebimento:', new Date(receipt.receivedAt).toLocaleString('pt-BR')],
      ['Recebido por:', receipt.receivedByName],
      ['NF/Romaneio:', receipt.invoiceNumber || 'N/A'],
      ['Data da NF:', receipt.invoiceDate || 'N/A'],
      ['Temperatura Média:', receipt.overallTemperature ? `${receipt.overallTemperature.toFixed(1)}°C` : 'N/A'],
      ['Conformidade:', receipt.temperatureCompliant ? '✓ Conforme' : '✗ Não Conforme'],
    ]

    autoTable(doc, {
      body: infoData,
      theme: 'plain',
      startY: yPos,
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: [80, 80, 80] },
        1: { textColor: [60, 60, 60] },
      },
    })

    yPos = (doc as any).lastAutoTable.finalY + 8

    // Notes section
    if (receipt.notes) {
      doc.setFontSize(10)
      doc.setTextColor(80, 80, 80)
      doc.text('Observações:', margin, yPos)
      yPos += 5
      doc.setTextColor(60, 60, 60)
      const splitNotes = doc.splitTextToSize(receipt.notes, pageWidth - margin * 2)
      doc.text(splitNotes, margin, yPos)
      yPos += splitNotes.length * 5 + 5
    }

    // Items table
    if (receipt.items && receipt.items.length > 0) {
      doc.setFontSize(12)
      doc.setTextColor(0, 100, 80)
      doc.text('Itens Recebidos', margin, yPos)
      yPos += 6

      const itemsBody = receipt.items.map(item => [
        item.item_name,
        `${item.quantity} ${item.unit}`,
        item.temperature ? `${item.temperature.toFixed(1)}°C` : '--',
        item.temperature_compliant ? 'OK' : 'Problema',
        CATEGORY_LABELS[item.category || ''] || item.category || '--',
      ])

      autoTable(doc, {
        head: [['Item', 'Qtd', 'Temp.', 'Status', 'Categoria']],
        body: itemsBody,
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: {
          fillColor: [0, 100, 80],
          textColor: [255, 255, 255],
          fontSize: 9,
        },
        styles: {
          fontSize: 9,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 25 },
          2: { cellWidth: 25 },
          3: { cellWidth: 25 },
          4: { cellWidth: 'auto' },
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const value = data.cell.raw as string
            if (value === 'Problema') {
              data.cell.styles.textColor = [200, 50, 50]
              data.cell.styles.fontStyle = 'bold'
            } else if (value === 'OK') {
              data.cell.styles.textColor = [0, 150, 100]
            }
          }
        },
      })

      yPos = (doc as any).lastAutoTable.finalY + 8
    }

    // Images section
    if (receipt.images && receipt.images.length > 0) {
      doc.setFontSize(12)
      doc.setTextColor(0, 100, 80)
      doc.text('Documentação (Imagens)', margin, yPos)
      yPos += 6

      const imageTypeLabels: Record<string, string> = {
        delivery_note: 'Nota Fiscal/Romaneio',
        protein_label: 'Rótulo de Rastreabilidade',
        temperature_log: 'Registro de Temperatura',
        other: 'Outros',
      }

      const imagesBody = receipt.images.map(img => [
        imageTypeLabels[img.imageType] || img.imageType,
        img.pageNumber > 1 ? `Página ${img.pageNumber}` : 'Principal',
        img.productName || '--',
        img.batchNumber || '--',
        img.useByDate || '--',
        new Date(img.createdAt).toLocaleString('pt-BR'),
      ])

      autoTable(doc, {
        head: [['Tipo', 'Página', 'Produto', 'Lote', 'Validade', 'Data Captura']],
        body: imagesBody,
        startY: yPos,
        margin: { left: margin, right: margin },
        theme: 'striped',
        headStyles: {
          fillColor: [0, 100, 80],
          textColor: [255, 255, 255],
          fontSize: 8,
        },
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
      })
    }

    addFooter()
  }

  // Return as blob
  return doc.output('blob')
}

/**
 * Download a PDF report
 */
export function downloadPdfReport(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate a summary report (single page overview)
 */
export function generateSummaryReport(
  receipts: ReceiptWithDetails[],
  options: GenerateReportOptions
): Blob {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  })

  const margin = 15

  // Header
  doc.setFontSize(18)
  doc.setTextColor(0, 100, 80)
  doc.text(`Resumo de Recebimentos - ${options.siteName}`, margin, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')} por ${options.generatedBy}`, margin, 28)

  // Summary stats
  const compliantCount = receipts.filter(r => r.temperatureCompliant).length
  const nonCompliantCount = receipts.length - compliantCount
  const totalItems = receipts.reduce((sum, r) => sum + (r.items?.length || 0), 0)

  const summaryData = [
    ['Total de Recebimentos', receipts.length.toString()],
    ['Conformes', compliantCount.toString()],
    ['Não Conformes', nonCompliantCount.toString()],
    ['Total de Itens', totalItems.toString()],
  ]

  autoTable(doc, {
    head: [['Métrica', 'Valor']],
    body: summaryData,
    startY: 35,
    margin: { left: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [0, 100, 80],
      textColor: [255, 255, 255],
    },
    styles: {
      fontSize: 10,
    },
  })

  // Main table
  const tableBody = receipts.map((r, idx) => [
    (idx + 1).toString(),
    new Date(r.receivedAt).toLocaleDateString('pt-BR'),
    r.supplierName,
    r.invoiceNumber || '--',
    r.receivedByName,
    r.overallTemperature ? `${r.overallTemperature.toFixed(1)}°C` : '--',
    r.temperatureCompliant ? 'Conforme' : 'Não Conforme',
    STATUS_LABELS[r.status] || r.status,
  ])

  autoTable(doc, {
    head: [['#', 'Data', 'Fornecedor', 'NF', 'Recebido por', 'Temp.', 'Conform.', 'Status']],
    body: tableBody,
    startY: 70,
    margin: { left: margin, right: margin },
    theme: 'striped',
    headStyles: {
      fillColor: [0, 100, 80],
      textColor: [255, 255, 255],
      fontSize: 9,
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 25 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 30 },
      4: { cellWidth: 35 },
      5: { cellWidth: 20 },
      6: { cellWidth: 25 },
      7: { cellWidth: 25 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        const value = data.cell.raw as string
        if (value === 'Não Conforme') {
          data.cell.styles.textColor = [200, 50, 50]
        } else {
          data.cell.styles.textColor = [0, 150, 100]
        }
      }
    },
  })

  // Footer
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text('ChefVoice Kitchen Compliance - Documento para fins de auditoria HACCP', margin, doc.internal.pageSize.height - 10)

  return doc.output('blob')
}

export type { ReceiptWithDetails, GenerateReportOptions, ReportFilters }
