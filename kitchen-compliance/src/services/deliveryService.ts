/**
 * Delivery Service
 * Handles goods receipt operations and image storage in Supabase
 */

import { supabase } from '@/lib/supabase'
import { compressImage, COMPRESSION_PRESETS, formatFileSize } from '@/lib/imageCompression'
import type { 
  GoodsReceiptInsert, 
} from '@/types/database.types'

// Type assertion helper to work around Supabase client type issues
const db = supabase as any
type AnyRow = Record<string, any>

// Types
export type ImageType = 'delivery_note' | 'protein_label' | 'temperature_log' | 'other'
export type TempCategory = 'chilled' | 'frozen' | 'ambient' | 'dry' | 'produce' | 'meat' | 'dairy' | 'seafood'
export type ReceiptStatus = 'draft' | 'completed' | 'flagged' | 'voided'

export interface GoodsReceiptInput {
  siteId: string
  supplierName: string
  invoiceNumber?: string
  invoiceDate?: string
  receivedByStaffId?: string
  receivedByName: string
  receivedAt?: string
  overallTemperature?: number
  temperatureCompliant?: boolean
  ocrRawText?: string
  ocrConfidence?: number
  notes?: string
  status?: ReceiptStatus
}

export interface ReceiptItemInput {
  itemName: string
  quantity: number
  unit: string
  temperature?: number
  temperatureCompliant?: boolean
  category?: TempCategory
  notes?: string
  sortOrder?: number
}

export interface DeliveryImageInput {
  receiptId: string
  imageType: ImageType
  file: File | Blob
  originalFilename?: string
  pageNumber?: number
  description?: string
  // Protein label specific
  productName?: string
  batchNumber?: string
  useByDate?: string
  supplierCode?: string
  // OCR data
  ocrProcessed?: boolean
  ocrText?: string
}

export interface GoodsReceipt {
  id: string
  siteId: string
  supplierName: string
  invoiceNumber: string | null
  invoiceDate: string | null
  receivedByStaffId: string | null
  receivedByName: string
  receivedAt: string
  overallTemperature: number | null
  temperatureCompliant: boolean
  ocrRawText: string | null
  ocrConfidence: number | null
  invoiceImageUrl: string | null
  notes: string | null
  status: ReceiptStatus
  createdAt: string
  updatedAt: string
}

export interface DeliveryImage {
  id: string
  receiptId: string
  imageType: ImageType
  storagePath: string
  originalFilename: string | null
  compressedSizeBytes: number | null
  originalSizeBytes: number | null
  mimeType: string
  pageNumber: number
  description: string | null
  productName: string | null
  batchNumber: string | null
  useByDate: string | null
  supplierCode: string | null
  ocrProcessed: boolean
  ocrText: string | null
  capturedAt: string
  createdAt: string
}

// Storage bucket name
const STORAGE_BUCKET = 'delivery-images'

/**
 * Create a new goods receipt
 */
export async function createGoodsReceipt(
  input: GoodsReceiptInput,
  items: ReceiptItemInput[]
): Promise<{ receipt: GoodsReceipt; items: AnyRow[] } | null> {
  try {
    // Verify supabase client is available
    if (!db) {
      console.error('❌ Supabase client is not initialized')
      throw new Error('Database connection not available')
    }

    // Validate required inputs
    if (!input.siteId) {
      console.error('❌ Site ID is required but was:', input.siteId)
      throw new Error('Site ID is required')
    }
    
    if (!input.supplierName) {
      console.error('❌ Supplier name is required but was:', input.supplierName)
      throw new Error('Supplier name is required')
    }
    
    if (!input.receivedByName) {
      console.error('❌ Received by name is required but was:', input.receivedByName)
      throw new Error('Received by name is required')
    }

    // Prepare receipt data
    // Note: received_by_staff_id is set to null because local staff members
    // might not be synced to the database yet. We store the name instead.
    const receiptData: GoodsReceiptInsert = {
      site_id: input.siteId,
      supplier_name: input.supplierName,
      invoice_number: input.invoiceNumber || null,
      invoice_date: input.invoiceDate || null,
      received_by_staff_id: null, // FK constraint - staff might not exist in DB
      received_by_name: input.receivedByName,
      received_at: input.receivedAt || new Date().toISOString(),
      overall_temperature: input.overallTemperature || null,
      temperature_compliant: input.temperatureCompliant ?? true,
      ocr_raw_text: input.ocrRawText || null,
      ocr_confidence: input.ocrConfidence || null,
      notes: input.notes || null,
      status: input.status || 'completed',
    }

    // Insert goods receipt using db (typed as any to bypass type issues)
    console.log('📦 Creating goods receipt with data:', JSON.stringify(receiptData, null, 2))
    
    const { data: receipt, error: receiptError } = await db
      .from('goods_receipts')
      .insert(receiptData)
      .select()
      .single()

    if (receiptError) {
      console.error('❌ Error creating goods receipt:', {
        message: receiptError.message,
        code: receiptError.code,
        details: receiptError.details,
        hint: receiptError.hint,
        full: receiptError,
      })
      throw receiptError
    }
    
    console.log('✅ Goods receipt created successfully:', receipt?.id)

    const receiptId = receipt.id

    // Prepare items data
    const itemsToInsert = items.map((item, idx) => ({
      receipt_id: receiptId,
      item_name: item.itemName,
      quantity: item.quantity,
      unit: item.unit,
      temperature: item.temperature || null,
      temperature_compliant: item.temperatureCompliant ?? true,
      category: item.category || 'ambient',
      notes: item.notes || null,
      sort_order: item.sortOrder ?? idx,
    }))

    const { data: insertedItems, error: itemsError } = await db
      .from('goods_receipt_items')
      .insert(itemsToInsert)
      .select()

    if (itemsError) {
      console.error('Error creating receipt items:', itemsError)
      // Rollback receipt if items fail
      await db.from('goods_receipts').delete().eq('id', receiptId)
      throw itemsError
    }

    return {
      receipt: mapReceiptFromDb(receipt),
      items: insertedItems as AnyRow[] || [],
    }
  } catch (error) {
    console.error('createGoodsReceipt error:', error)
    return null
  }
}

/**
 * Upload and compress a delivery image
 */
export async function uploadDeliveryImage(
  input: DeliveryImageInput,
  onProgress?: (progress: number, status: string) => void
): Promise<DeliveryImage | null> {
  try {
    onProgress?.(10, 'Compressing image...')

    // Select compression preset based on image type
    const preset = input.imageType === 'delivery_note' 
      ? COMPRESSION_PRESETS.deliveryNote 
      : COMPRESSION_PRESETS.proteinLabel

    // Compress the image
    const compressed = await compressImage(input.file, preset)
    
    console.log(`📸 Image compressed: ${formatFileSize(compressed.originalSize)} → ${formatFileSize(compressed.compressedSize)} (${compressed.compressionRatio}% reduction)`)
    
    onProgress?.(40, 'Uploading to storage...')

    // Generate storage path
    const timestamp = Date.now()
    const extension = 'jpg'
    const storagePath = `${input.receiptId}/${input.imageType}_${input.pageNumber || 1}_${timestamp}.${extension}`

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, compressed.blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      throw uploadError
    }

    onProgress?.(70, 'Saving image record...')

    // Insert delivery_images record
    const { data: imageRecord, error: dbError } = await db
      .from('delivery_images')
      .insert({
        receipt_id: input.receiptId,
        image_type: input.imageType,
        storage_path: storagePath,
        original_filename: input.originalFilename || null,
        compressed_size_bytes: compressed.compressedSize,
        original_size_bytes: compressed.originalSize,
        mime_type: 'image/jpeg',
        page_number: input.pageNumber || 1,
        description: input.description || null,
        product_name: input.productName || null,
        batch_number: input.batchNumber || null,
        use_by_date: input.useByDate || null,
        supplier_code: input.supplierCode || null,
        ocr_processed: input.ocrProcessed || false,
        ocr_text: input.ocrText || null,
        captured_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (dbError) {
      console.error('Error saving image record:', dbError)
      // Try to clean up uploaded file
      await db.storage.from(STORAGE_BUCKET).remove([storagePath])
      throw dbError
    }

    onProgress?.(100, 'Complete')

    return mapImageFromDb(imageRecord)
  } catch (error) {
    console.error('uploadDeliveryImage error:', error)
    return null
  }
}

/**
 * Upload multiple images for a receipt (e.g., multi-page delivery note)
 */
export async function uploadMultipleImages(
  receiptId: string,
  files: Array<{ file: File | Blob; type: ImageType; metadata?: Partial<DeliveryImageInput> }>,
  onProgress?: (current: number, total: number, status: string) => void
): Promise<DeliveryImage[]> {
  const results: DeliveryImage[] = []
  
  for (let i = 0; i < files.length; i++) {
    const { file, type, metadata } = files[i]
    onProgress?.(i + 1, files.length, `Processing image ${i + 1} of ${files.length}...`)
    
    const image = await uploadDeliveryImage({
      receiptId,
      imageType: type,
      file,
      pageNumber: metadata?.pageNumber || i + 1,
      originalFilename: metadata?.originalFilename,
      description: metadata?.description,
      productName: metadata?.productName,
      batchNumber: metadata?.batchNumber,
      useByDate: metadata?.useByDate,
      supplierCode: metadata?.supplierCode,
      ocrProcessed: metadata?.ocrProcessed,
      ocrText: metadata?.ocrText,
    })
    
    if (image) {
      results.push(image)
    }
  }
  
  return results
}

/**
 * Get public URL for a delivery image
 */
export function getImagePublicUrl(storagePath: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath)
  
  return data.publicUrl
}

/**
 * Get all images for a receipt
 */
export async function getReceiptImages(receiptId: string): Promise<DeliveryImage[]> {
  const { data, error } = await db
    .from('delivery_images')
    .select('*')
    .eq('receipt_id', receiptId)
    .order('image_type')
    .order('page_number')

  if (error) {
    console.error('Error fetching receipt images:', error)
    return []
  }

  return (data || []).map(mapImageFromDb)
}

/**
 * Get goods receipt by ID with items and images
 */
export async function getGoodsReceiptWithDetails(receiptId: string): Promise<{
  receipt: GoodsReceipt
  items: AnyRow[]
  images: DeliveryImage[]
} | null> {
  try {
    // Get receipt
    const { data: receipt, error: receiptError } = await db
      .from('goods_receipts')
      .select('*')
      .eq('id', receiptId)
      .single()

    if (receiptError) throw receiptError

    // Get items
    const { data: items, error: itemsError } = await db
      .from('goods_receipt_items')
      .select('*')
      .eq('receipt_id', receiptId)
      .order('sort_order')

    if (itemsError) throw itemsError

    // Get images
    const images = await getReceiptImages(receiptId)

    return {
      receipt: mapReceiptFromDb(receipt),
      items: items || [],
      images,
    }
  } catch (error) {
    console.error('getGoodsReceiptWithDetails error:', error)
    return null
  }
}

/**
 * List goods receipts for a site
 */
export async function listGoodsReceipts(
  siteId: string,
  options?: {
    limit?: number
    offset?: number
    status?: ReceiptStatus
    startDate?: string
    endDate?: string
  }
): Promise<{ receipts: GoodsReceipt[]; total: number }> {
  try {
    let query = db
      .from('goods_receipts')
      .select('*', { count: 'exact' })
      .eq('site_id', siteId)
      .order('received_at', { ascending: false })

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.startDate) {
      query = query.gte('received_at', options.startDate)
    }

    if (options?.endDate) {
      query = query.lte('received_at', options.endDate)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error, count } = await query

    if (error) throw error

    return {
      receipts: (data || []).map(mapReceiptFromDb),
      total: count || 0,
    }
  } catch (error) {
    console.error('listGoodsReceipts error:', error)
    return { receipts: [], total: 0 }
  }
}

/**
 * Delete a delivery image
 */
export async function deleteDeliveryImage(imageId: string): Promise<boolean> {
  try {
    // Get the image record first
    const { data: image, error: fetchError } = await db
      .from('delivery_images')
      .select('storage_path')
      .eq('id', imageId)
      .single()

    if (fetchError) throw fetchError

    // Delete from storage
    if (image?.storage_path) {
      await db.storage.from(STORAGE_BUCKET).remove([image.storage_path])
    }

    // Delete record
    const { error: deleteError } = await db
      .from('delivery_images')
      .delete()
      .eq('id', imageId)

    if (deleteError) throw deleteError

    return true
  } catch (error) {
    console.error('deleteDeliveryImage error:', error)
    return false
  }
}

// Helper: Map database record to GoodsReceipt type
function mapReceiptFromDb(record: any): GoodsReceipt {
  return {
    id: record.id,
    siteId: record.site_id,
    supplierName: record.supplier_name,
    invoiceNumber: record.invoice_number,
    invoiceDate: record.invoice_date,
    receivedByStaffId: record.received_by_staff_id,
    receivedByName: record.received_by_name,
    receivedAt: record.received_at,
    overallTemperature: record.overall_temperature,
    temperatureCompliant: record.temperature_compliant,
    ocrRawText: record.ocr_raw_text,
    ocrConfidence: record.ocr_confidence,
    invoiceImageUrl: record.invoice_image_url,
    notes: record.notes,
    status: record.status,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  }
}

// Helper: Map database record to DeliveryImage type
function mapImageFromDb(record: any): DeliveryImage {
  return {
    id: record.id,
    receiptId: record.receipt_id,
    imageType: record.image_type,
    storagePath: record.storage_path,
    originalFilename: record.original_filename,
    compressedSizeBytes: record.compressed_size_bytes,
    originalSizeBytes: record.original_size_bytes,
    mimeType: record.mime_type,
    pageNumber: record.page_number,
    description: record.description,
    productName: record.product_name,
    batchNumber: record.batch_number,
    useByDate: record.use_by_date,
    supplierCode: record.supplier_code,
    ocrProcessed: record.ocr_processed,
    ocrText: record.ocr_text,
    capturedAt: record.captured_at,
    createdAt: record.created_at,
  }
}

/**
 * Create storage bucket if it doesn't exist (run once on setup)
 */
export async function ensureStorageBucket(): Promise<boolean> {
  try {
    const { data: buckets } = await supabase.storage.listBuckets()
    const exists = buckets?.some(b => b.name === STORAGE_BUCKET)
    
    if (!exists) {
      const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, {
        public: false,
        fileSizeLimit: 50 * 1024 * 1024, // 50MB limit
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      })
      
      if (error) {
        console.error('Error creating storage bucket:', error)
        return false
      }
      
      console.log(`✅ Created storage bucket: ${STORAGE_BUCKET}`)
    }
    
    return true
  } catch (error) {
    console.error('ensureStorageBucket error:', error)
    return false
  }
}