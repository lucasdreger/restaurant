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

/**
 * Fetch image from URL and convert to base64
 */
async function imageToBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      console.error(`Failed to fetch image: ${url}`, response.status)
      return null
    }
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        // Remove data URL prefix if present
        const base64Data = base64.split(',')[1] || base64
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    console.error('Error converting image to base64:', error)
    return null
  }
}

/**
 * Get image format from mime type or URL
 */
function getImageFormat(url: string): 'JPEG' | 'PNG' | 'WEBP' {
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('.png')) return 'PNG'
  if (lowerUrl.includes('.webp')) return 'WEBP'
  return 'JPEG' // default
}

/**
 * Get image dimensions from base64 data
 */
function getImageDimensions(base64Data: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      resolve({ width: 0, height: 0 })
    }
    img.src = `data:image/jpeg;base64,${base64Data}`
  })
}

/**
 * Calculate image dimensions preserving aspect ratio
 */
function calculateImageDimensions(
  imgWidth: number,
  imgHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (imgWidth === 0 || imgHeight === 0) {
    return { width: maxWidth, height: maxHeight }
  }

  const aspectRatio = imgWidth / imgHeight

  // Try fitting to max width first
  let newWidth = maxWidth
  let newHeight = maxWidth / aspectRatio

  // If height exceeds max, scale down
  if (newHeight > maxHeight) {
    newHeight = maxHeight
    newWidth = maxHeight * aspectRatio
  }

  return { width: newWidth, height: newHeight }
}

// Status translations for English
const STATUS_LABELS: Record<string, string> = {
  completed: 'Completed',
  draft: 'Draft',
  flagged: 'Flagged',
  voided: 'Voided',
}

// Category translations
const CATEGORY_LABELS: Record<string, string> = {
  chilled: 'Chilled',
  frozen: 'Frozen',
  ambient: 'Ambient',
  dry: 'Dry',
  produce: 'Produce',
  meat: 'Meat',
  dairy: 'Dairy',
  seafood: 'Seafood',
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
    doc.text(`ChefVoice Kitchen Compliance - Goods Receipt Report`, margin, 10)
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 30, 10)
    doc.setDrawColor(200, 200, 200)
    doc.line(margin, 12, pageWidth - margin, 12)
  }

  // Helper function to add footer
  const addFooter = () => {
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    const footerText = `Report generated on: ${new Date().toLocaleString('en-IE')} by ${options.generatedBy}`
    doc.text(footerText, margin, pageHeight - 10)
    doc.text('Document for HACCP audit purposes', pageWidth - margin - 60, pageHeight - 10)
  }

  // Cover Page
  doc.setFontSize(24)
  doc.setTextColor(0, 100, 80)
  doc.text('Goods Receipt Report', margin, 40)

  doc.setFontSize(14)
  doc.setTextColor(60, 60, 60)
  doc.text(`Establishment: ${options.siteName}`, margin, 55)
  if (options.siteAddress) {
    doc.setFontSize(11)
    doc.text(`Address: ${options.siteAddress}`, margin, 62)
  }

  // Summary box
  doc.setFillColor(240, 248, 245)
  doc.roundedRect(margin, 70, pageWidth - margin * 2, 50, 3, 3, 'F')

  doc.setFontSize(12)
  doc.setTextColor(0, 100, 80)
  doc.text('Report Summary', margin + 5, 80)

  doc.setFontSize(10)
  doc.setTextColor(60, 60, 60)
  doc.text(`Total Receipts: ${receipts.length}`, margin + 5, 88)
  
  const compliantCount = receipts.filter(r => r.temperatureCompliant).length
  const nonCompliantCount = receipts.length - compliantCount
  
  doc.text(`Compliant Receipts: ${compliantCount}`, margin + 5, 94)
  doc.text(`Non-Compliant Receipts: ${nonCompliantCount}`, margin + 5, 100)
  
  const totalItems = receipts.reduce((sum, r) => sum + (r.items?.length || 0), 0)
  doc.text(`Total Items Received: ${totalItems}`, margin + 5, 106)
  
  const totalImages = receipts.reduce((sum, r) => sum + (r.images?.length || 0), 0)
  doc.text(`Total Images Attached: ${totalImages}`, margin + 5, 112)

  // Filters info
  if (options.filters) {
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    let filterY = 130
    doc.text('Filters Applied:', margin, filterY)
    filterY += 6
    
    if (options.filters.startDate) {
      doc.text(`- Start Date: ${options.filters.startDate}`, margin + 5, filterY)
      filterY += 5
    }
    if (options.filters.endDate) {
      doc.text(`- End Date: ${options.filters.endDate}`, margin + 5, filterY)
      filterY += 5
    }
    if (options.filters.status && options.filters.status !== 'all') {
      doc.text(`- Status: ${STATUS_LABELS[options.filters.status] || options.filters.status}`, margin + 5, filterY)
      filterY += 5
    }
    if (options.filters.search) {
      doc.text(`- Search: "${options.filters.search}"`, margin + 5, filterY)
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
    doc.text(`Receipt #${i + 1}`, margin, yPos)
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
      ['Supplier:', receipt.supplierName],
      ['Received Date:', new Date(receipt.receivedAt).toLocaleString('en-IE')],
      ['Received by:', receipt.receivedByName],
      ['Invoice #:', receipt.invoiceNumber || 'N/A'],
      ['Invoice Date:', receipt.invoiceDate || 'N/A'],
      ['Average Temperature:', receipt.overallTemperature ? `${receipt.overallTemperature.toFixed(1)}°C` : 'N/A'],
      ['Compliance:', receipt.temperatureCompliant ? '✓ Compliant' : '✗ Non-Compliant'],
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
      doc.text('Notes:', margin, yPos)
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
      doc.text('Items Received', margin, yPos)
      yPos += 6

      const itemsBody = receipt.items.map(item => [
        item.item_name,
        `${item.quantity} ${item.unit}`,
        item.temperature ? `${item.temperature.toFixed(1)}°C` : '--',
        item.temperature_compliant ? 'OK' : 'Issue',
        CATEGORY_LABELS[item.category || ''] || item.category || '--',
      ])

      autoTable(doc, {
        head: [['Item', 'Qty', 'Temp.', 'Status', 'Category']],
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
            if (value === 'Issue') {
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
      doc.text('Documentation (Images)', margin, yPos)
      yPos += 6

      const imageTypeLabels: Record<string, string> = {
        delivery_note: 'Delivery Note/Invoice',
        protein_label: 'Traceability Label',
        temperature_log: 'Temperature Log',
        other: 'Other',
      }

      if (options.includeImages) {
        // Embed actual images
        for (let imgIdx = 0; imgIdx < receipt.images.length; imgIdx++) {
          const img = receipt.images[imgIdx]
          
          // Check if we need a new page
          if (yPos > pageHeight - 100) {
            doc.addPage()
            addHeader(doc.getNumberOfPages(), receipts.length + 1)
            yPos = 25
          }

          // Image label
          doc.setFontSize(10)
          doc.setTextColor(80, 80, 80)
          const label = `${imageTypeLabels[img.imageType] || img.imageType}${img.pageNumber > 1 ? ` (Page ${img.pageNumber})` : ''}`
          doc.text(label, margin, yPos)
          yPos += 5

          // Fetch and embed image
          try {
            const { getImagePublicUrl } = await import('./deliveryService')
            const imageUrl = getImagePublicUrl(img.storagePath)
            const base64Data = await imageToBase64(imageUrl)
            
            if (base64Data) {
              const format = getImageFormat(img.storagePath)
              
              // Get original dimensions and calculate scaled size preserving aspect ratio
              const { width: origWidth, height: origHeight } = await getImageDimensions(base64Data)
              const maxWidth = pageWidth - margin * 2
              const maxHeight = 100 // Maximum height to prevent images from taking too much space
              
              const { width: imgWidth, height: imgHeight } = calculateImageDimensions(
                origWidth,
                origHeight,
                maxWidth,
                maxHeight
              )
              
              doc.addImage(base64Data, format, margin, yPos, imgWidth, imgHeight)
              yPos += imgHeight + 10
            } else {
              doc.setFontSize(9)
              doc.setTextColor(150, 150, 150)
              doc.text('[Image not available]', margin, yPos)
              yPos += 10
            }
          } catch (error) {
            console.error('Error embedding image:', error)
            doc.setFontSize(9)
            doc.setTextColor(150, 150, 150)
            doc.text('[Error loading image]', margin, yPos)
            yPos += 10
          }
        }
      } else {
        // Just show table of images (original behavior)
        const imagesBody = receipt.images.map(img => [
          imageTypeLabels[img.imageType] || img.imageType,
          img.pageNumber > 1 ? `Page ${img.pageNumber}` : 'Main',
          img.productName || '--',
          img.batchNumber || '--',
          img.useByDate || '--',
          new Date(img.createdAt).toLocaleString('en-IE'),
        ])

        autoTable(doc, {
          head: [['Type', 'Page', 'Product', 'Batch', 'Use By', 'Capture Date']],
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
  doc.text(`Receipts Summary - ${options.siteName}`, margin, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated on: ${new Date().toLocaleString('en-IE')} by ${options.generatedBy}`, margin, 28)

  // Summary stats
  const compliantCount = receipts.filter(r => r.temperatureCompliant).length
  const nonCompliantCount = receipts.length - compliantCount
  const totalItems = receipts.reduce((sum, r) => sum + (r.items?.length || 0), 0)

  const summaryData = [
    ['Total Receipts', receipts.length.toString()],
    ['Compliant', compliantCount.toString()],
    ['Non-Compliant', nonCompliantCount.toString()],
    ['Total Items', totalItems.toString()],
  ]

  autoTable(doc, {
    head: [['Metric', 'Value']],
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
    new Date(r.receivedAt).toLocaleDateString('en-IE'),
    r.supplierName,
    r.invoiceNumber || '--',
    r.receivedByName,
    r.overallTemperature ? `${r.overallTemperature.toFixed(1)}°C` : '--',
    r.temperatureCompliant ? 'Compliant' : 'Non-Compliant',
    STATUS_LABELS[r.status] || r.status,
  ])

  autoTable(doc, {
    head: [['#', 'Date', 'Supplier', 'Invoice', 'Received by', 'Temp.', 'Compliance', 'Status']],
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
        if (value === 'Non-Compliant') {
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
  doc.text('ChefVoice Kitchen Compliance - Document for HACCP audit purposes', margin, doc.internal.pageSize.height - 10)

  return doc.output('blob')
}

export type { ReceiptWithDetails, GenerateReportOptions, ReportFilters }
