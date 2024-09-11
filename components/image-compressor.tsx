'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Info, UploadCloud, Download, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Image from 'next/image'
import { Button } from './ui/button'

const MAX_IMAGES = 10
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

type ImageFile = {
	file: File
	preview: string
	compressedUrl?: string
	isCompressing: boolean
	error?: string
	originalSize?: number
	compressedSize?: number
	compressionPercentage?: number
}

export default function ImageCompressor() {
	const [images, setImages] = useState<ImageFile[]>([])
	const [isCompressing, setIsCompressing] = useState(false)
	const [compressedCount, setCompressedCount] = useState(0)
	const [error, setError] = useState<string | null>(null)
	const [outputFormat, setOutputFormat] = useState('webp')
	const [showProgress, setShowProgress] = useState(false)

	useEffect(() => {
		return () => {
			images.forEach(img => URL.revokeObjectURL(img.preview))
		}
	}, [images])

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		const droppedFiles = Array.from(e.dataTransfer.files)
		addFiles(droppedFiles)
	}

	const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files) {
			const selectedFiles = Array.from(e.target.files)
			addFiles(selectedFiles)
		}
	}

	const addFiles = (newFiles: File[]) => {
		if (images.length + newFiles.length > MAX_IMAGES) {
			setError(`You can only upload up to ${MAX_IMAGES} images at a time.`)
			return
		}

		const validFiles = newFiles.filter(file => {
			if (file.size > MAX_FILE_SIZE) {
				toast.error(`${file.name} is too large. Max file size is 5MB.`)
				return false
			}
			if (!file.type.startsWith('image/')) {
				toast.error(`${file.name} is not a valid image file.`)
				return false
			}
			return true
		})

		const newImages = validFiles.map(file => ({
			file,
			preview: URL.createObjectURL(file),
			isCompressing: false,
			originalSize: file.size,
		}))

		setImages(prevImages => [...prevImages, ...newImages])
		setError(null)
	}

	const removeImage = (index: number) => {
		setImages(prevImages => prevImages.filter((_, i) => i !== index))
	}

	const compressImage = async (image: ImageFile, index: number) => {
		setImages(prevImages => prevImages.map((img, i) => (i === index ? { ...img, isCompressing: true } : img)))

		const formData = new FormData()
		formData.append('image', image.file)
		formData.append('format', outputFormat)

		try {
			const response = await fetch('/api/compress', {
				method: 'POST',
				body: formData,
			})

			if (response.ok) {
				const blob = await response.blob()
				const compressedUrl = URL.createObjectURL(blob)
				// const originalSize = Number(response.headers.get('X-Original-Size'))
				const compressedSize = Number(response.headers.get('X-Compressed-Size'))
				const compressionPercentage = Number(response.headers.get('X-Compression-Percentage'))

				setImages(prevImages =>
					prevImages.map((img, i) =>
						i === index
							? {
									...img,
									isCompressing: false,
									compressedUrl,
									compressedSize,
									compressionPercentage,
							  }
							: img
					)
				)
				setCompressedCount(prev => prev + 1)
			} else {
				throw new Error(`Server error: ${response.statusText}`)
			}
		} catch (error) {
			console.error(`Error compressing ${image.file.name}:`, error)
			setImages(prevImages =>
				prevImages.map((img, i) =>
					i === index ? { ...img, isCompressing: false, error: 'Compression failed' } : img
				)
			)
			toast.error(`Failed to compress ${image.file.name}`)
		}
	}

	const compressImages = async () => {
		setIsCompressing(true)
		setError(null)
		setCompressedCount(0)
		setShowProgress(true)

		for (let i = 0; i < images.length; i++) {
			await compressImage(images[i], i)
		}

		setIsCompressing(false)
		if (compressedCount > 0) {
			toast.success(`Successfully compressed ${compressedCount} image(s)`)
		}
	}

	const downloadImage = (image: ImageFile) => {
		if (image.compressedUrl) {
			const link = document.createElement('a')
			link.href = image.compressedUrl
			link.download = `compressed-${image.file.name}`
			document.body.appendChild(link)
			link.click()
			document.body.removeChild(link)
		}
	}

	const downloadAllImages = async () => {
		const compressedImages = images.filter(img => img.compressedUrl)
		if (compressedImages.length === 0) {
			toast.error('No compressed images to download')
			return
		}

		const filesData = compressedImages.map(async img => {
			// @ts-expect-error sdasd
			const response = await fetch(img.compressedUrl)
			const blob = await response.blob()
			const arrayBuffer = await blob.arrayBuffer()
			return {
				name: `compressed-${img.file.name}`,
				buffer: Buffer.from(arrayBuffer).toString('base64'), // Send as base64 string
			}
		})

		try {
			const response = await fetch('/api/rar', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					files: await Promise.all(filesData),
				}),
			})

			if (response.ok) {
				const blob = await response.blob()
				const url = URL.createObjectURL(blob)
				const link = document.createElement('a')
				link.href = url
				link.download = `compressed_images_${Date.now()}.zip`
				document.body.appendChild(link)
				link.click()
				document.body.removeChild(link)
				URL.revokeObjectURL(url)
			} else {
				throw new Error('Failed to create ZIP file')
			}
		} catch (error) {
			console.error('Error downloading all images:', error)
			toast.error('Failed to download all images')
		}
	}

	return (
		<div className="min-h-screen bg-gray-100 py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-3xl mx-auto">
				<header className="text-center mb-8">
					<h1 className="text-3xl font-bold text-gray-900 mb-2">Image Compressor</h1>
					<p className="text-gray-600">Compress your images quickly and easily</p>
				</header>

				<Card className="mb-8">
					<CardContent className="p-6">
						<div
							onDrop={handleDrop}
							onDragOver={e => e.preventDefault()}
							className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
						>
							<input
								type="file"
								multiple
								accept="image/*"
								onChange={handleFileInput}
								className="hidden"
								id="fileInput"
							/>
							<label htmlFor="fileInput" className="cursor-pointer">
								<UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
								<p className="text-lg font-semibold text-gray-700 mb-1">Drop your images here</p>
								<p className="text-sm text-gray-500">or click to select files</p>
							</label>
						</div>
						{error && <p className="mt-2 text-red-500 text-sm">{error}</p>}
					</CardContent>
				</Card>

				{images.length > 0 && (
					<Card className="mb-8">
						<CardContent className="p-6">
							<h2 className="text-xl font-semibold mb-4">
								Images ({images.length}/{MAX_IMAGES})
							</h2>
							<div className="mb-4">
								<label htmlFor="outputFormat" className="block text-sm font-medium text-gray-700">
									Output Format
								</label>
								<Select onValueChange={setOutputFormat} value={outputFormat}>
									<SelectTrigger className="w-full">
										<SelectValue placeholder="Select output format" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="webp">WebP</SelectItem>
										<SelectItem value="png">PNG</SelectItem>
										<SelectItem value="jpg">JPG</SelectItem>
										<SelectItem value="original">Original Format</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
								{images.map((image, index) => (
									<div key={index} className="relative group">
										<div className="aspect-square bg-gray-200 rounded-lg flex items-center justify-center overflow-hidden relative">
											<Image
												src={image.compressedUrl || image.preview}
												alt={image.file.name}
												className="object-cover min-w-full min-h-full"
												height={10}
												width={10}
											/>
											{image.isCompressing && (
												<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
													<div className="border-4 border-white border-t-transparent rounded-full animate-spin" />
												</div>
											)}
										</div>
										<Button
											onClick={() => removeImage(index)}
											className="absolute min-w-6 min-h-6 max-w-6 max-h-6 top-1 right-1 bg-red-500 text-white rounded-full p-1"
										>
											<X size={16} />
										</Button>
										{/* <p className="mt-1 text-xs text-gray-500 truncate">{image.file.name}</p> */}
										{image.error && <p className="mt-2 text-sm text-red-500">{image.error}</p>}
										{image.compressedSize && (
											<>
												<p className="mt-2 text-sm text-green-500">
													Saved: {image.compressionPercentage}%
												</p>
												<Button
													onClick={() => downloadImage(image)}
													className="mt-2 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
												>
													<Download />
												</Button>
											</>
										)}
									</div>
								))}
							</div>

							<div className="mt-4">
								<div className="mb-2 flex justify-between items-center">
									<span className="text-sm text-gray-600">
										{showProgress && `Overall Progress: ${compressedCount}/${images.length}`}
									</span>
									<div className="space-x-2">
										<Button
											onClick={compressImages}
											disabled={isCompressing || images.length === 0}
											className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-blue-300"
										>
											{isCompressing ? 'Compressing...' : 'Compress Images'}
										</Button>
										{compressedCount > 0 && (
											<Button
												onClick={downloadAllImages}
												className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
											>
												<Download className="mr-2 h-4 w-4" />
												Download All
											</Button>
										)}
									</div>
								</div>
								{showProgress && (
									<div className="w-full bg-gray-200 rounded-full h-2.5">
										<div
											className="bg-blue-600 h-2.5 rounded-full"
											style={{ width: `${(compressedCount / images.length) * 100}%` }}
										></div>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				)}

				<footer className="text-center text-sm text-gray-500">
					<p className="flex items-center justify-center">
						<Info className="h-4 w-4 mr-1" />
						Compress up to {MAX_IMAGES} images at once, max 5MB each
					</p>
				</footer>
			</div>
		</div>
	)
}
