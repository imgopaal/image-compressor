import { type NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData()
    const file: File | null = data.get('image') as unknown as File
    const format = data.get('format') as string

    if (!file) {
      return NextResponse.json({ success: false, message: 'No image file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    let sharpInstance = sharp(buffer).resize(800)

    switch (format) {
      case 'png':
        sharpInstance = sharpInstance.png({ quality: 80 })
        break
      case 'jpg':
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality: 80 })
        break
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality: 80 })
        break
      case 'original':
        // Keep the original format
        break
      default:
        sharpInstance = sharpInstance.webp({ quality: 80 })
    }

    const compressedImage = await sharpInstance.toBuffer()

    // Calculate compression percentage
    const originalSize = buffer.length
    const compressedSize = compressedImage.length
    const compressionPercentage = ((originalSize - compressedSize) / originalSize) * 100

    // Return the compressed image directly in the response
    return new NextResponse(compressedImage, {
      status: 200,
      headers: {
        'Content-Type': `image/${format === 'original' ? file.type.split('/')[1] : format}`,
        'Content-Disposition': `attachment; filename="compressed-${file.name}"`,
        'X-Original-Size': originalSize.toString(),
        'X-Compressed-Size': compressedSize.toString(),
        'X-Compression-Percentage': compressionPercentage.toFixed(2),
      },
    })
  } catch (error) {
    console.error('Error compressing image:', error)
    return NextResponse.json({ success: false, message: 'Error compressing image' }, { status: 500 })
  }
}