import { type NextRequest, NextResponse } from 'next/server'
import archiver from 'archiver'
import { Buffer } from 'buffer'

export async function POST(request: NextRequest) {
	try {
		const { files } = await request.json()

		if (!files || files.length === 0) {
			return NextResponse.json({ success: false, message: 'No files provided' }, { status: 400 })
		}

		const archive = archiver('zip', {
			zlib: { level: 9 }, // Sets the compression level.
		})

		for (const file of files) {
			const buffer = Buffer.from(file.buffer, 'base64') // Decode base64 to binary
			archive.append(buffer, { name: file.name })
		}

		await archive.finalize()

    // @ts-expect-error fdffd
		return new Response(archive, {
			status: 200,
			headers: {
				'Content-Type': 'application/zip',
				'Content-Disposition': `attachment; filename="compressed_images_${Date.now()}.zip"`,
			},
		})
	} catch (error) {
		console.error('Error creating ZIP file:', error)
		return NextResponse.json({ success: false, message: 'Error creating ZIP file' }, { status: 500 })
	}
}
