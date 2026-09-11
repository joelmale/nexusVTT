import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

interface PageImage {
  key: string
  url: string
  pageNumber: number | null
}

interface PageImagesResponse {
  documentId: string
  title: string
  count: number
  pages: PageImage[]
}

interface DocumentAnnotation {
  id: string
  documentId: string
  pageNumber: number
  position: {
    x: number
    y: number
    width?: number
    height?: number
  }
  type: 'highlight' | 'note' | 'drawing'
  content: string
  color: string
}

interface DocumentReference {
  id: string
  pageNumber?: number | null
  title: string
}

export default function Reader() {
  const { id } = useParams()
  const [data, setData] = useState<PageImagesResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [leftIndex, setLeftIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [activeTool, setActiveTool] = useState<'pan' | 'highlight' | 'note' | 'bookmark'>('pan')
  const [loupeEnabled, setLoupeEnabled] = useState(true)
  const [bookmarks, setBookmarks] = useState<DocumentReference[]>([])
  const [annotations, setAnnotations] = useState<DocumentAnnotation[]>([])
  const [toolNotice, setToolNotice] = useState<string | null>(null)
  const [loupeState, setLoupeState] = useState<{
    visible: boolean
    x: number
    y: number
    imageX: number
    imageY: number
    imageWidth: number
    imageHeight: number
    src: string
  }>({
    visible: false,
    x: 0,
    y: 0,
    imageX: 0,
    imageY: 0,
    imageWidth: 0,
    imageHeight: 0,
    src: '',
  })
  const [drawState, setDrawState] = useState<{
    pageNumber: number
    startX: number
    startY: number
    currentX: number
    currentY: number
    imageWidth: number
    imageHeight: number
    type: 'highlight' | 'note'
  } | null>(null)
  const [imageMetrics, setImageMetrics] = useState<Record<string, { width: number; height: number }>>({})
  const leftImageRef = useRef<HTMLImageElement | null>(null)
  const rightImageRef = useRef<HTMLImageElement | null>(null)

  const resolveUserId = () => {
    if (typeof window === 'undefined') return 'admin'
    return (
      window.localStorage.getItem('adminUserId') ||
      window.localStorage.getItem('userId') ||
      window.localStorage.getItem('uid') ||
      'admin'
    )
  }

  const resolveCampaignId = () => {
    if (typeof window === 'undefined') return undefined
    return window.localStorage.getItem('campaignId') || undefined
  }

  useEffect(() => {
    if (!id) return
    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/documents/${id}/page-images`)
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load page images')
        }
        if (isMounted) {
          setData(payload)
          setLeftIndex(0)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load reader')
        }
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [id])

  useEffect(() => {
    if (!id) return
    let isMounted = true

    const loadAnnotations = async () => {
      try {
        const params = new URLSearchParams()
        params.set('userId', resolveUserId())
        const campaignId = resolveCampaignId()
        if (campaignId) params.set('campaignId', campaignId)
        const response = await fetch(`/api/documents/${id}/annotations?${params}`)
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load annotations')
        }
        if (isMounted) {
          setAnnotations(payload)
        }
      } catch (err) {
        if (isMounted) {
          setToolNotice(err instanceof Error ? err.message : 'Failed to load annotations')
        }
      }
    }

    const loadBookmarks = async () => {
      try {
        const params = new URLSearchParams()
        params.set('documentId', id)
        params.set('userId', resolveUserId())
        const campaignId = resolveCampaignId()
        if (campaignId) params.set('campaignId', campaignId)
        const response = await fetch(`/api/references?${params}`)
        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load bookmarks')
        }
        if (isMounted) {
          setBookmarks(payload.references || [])
        }
      } catch (err) {
        if (isMounted) {
          setToolNotice(err instanceof Error ? err.message : 'Failed to load bookmarks')
        }
      }
    }

    loadAnnotations()
    loadBookmarks()
    return () => {
      isMounted = false
    }
  }, [id])

  const pages = data?.pages || []
  const maxLeftIndex = useMemo(() => {
    if (pages.length === 0) return 0
    return pages.length % 2 === 0 ? pages.length - 2 : pages.length - 1
  }, [pages.length])

  const leftPage = pages[leftIndex]
  const rightPage = pages[leftIndex + 1]

  const goPrev = () => {
    setLeftIndex((prev) => Math.max(0, prev - 2))
  }

  const goNext = () => {
    setLeftIndex((prev) => Math.min(maxLeftIndex, prev + 2))
  }

  const jumpToPage = (pageNumber: number) => {
    const targetIndex = Math.max(0, Math.min(maxLeftIndex, pageNumber - 1))
    const alignedIndex = targetIndex % 2 === 0 ? targetIndex : Math.max(0, targetIndex - 1)
    setLeftIndex(alignedIndex)
  }

  const toggleBookmark = async (pageNumber: number) => {
    if (!id) return
    const existing = bookmarks.find((bookmark) => bookmark.pageNumber === pageNumber)
    if (existing) {
      try {
        const response = await fetch(`/api/references/${existing.id}`, {
          method: 'DELETE',
        })
        if (!response.ok) {
          const payload = await response.json()
          throw new Error(payload.error || 'Failed to delete bookmark')
        }
        setBookmarks((prev) => prev.filter((bookmark) => bookmark.id !== existing.id))
      } catch (err) {
        setToolNotice(err instanceof Error ? err.message : 'Failed to delete bookmark')
      }
      return
    }

    try {
      const response = await fetch('/api/references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: id,
          userId: resolveUserId(),
          campaignId: resolveCampaignId(),
          pageNumber,
          title: `Page ${pageNumber}`,
          notes: '',
          tags: [],
          isShared: false,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create bookmark')
      }
      setBookmarks((prev) => [...prev, payload])
    } catch (err) {
      setToolNotice(err instanceof Error ? err.message : 'Failed to create bookmark')
    }
  }

  const handlePageClick = (pageNumber?: number) => {
    if (!pageNumber) return
    if (activeTool === 'bookmark') {
      toggleBookmark(pageNumber)
    }
  }

  const zoomIn = () => {
    setZoom((prev) => Math.min(3, Number((prev + 0.2).toFixed(2))))
  }

  const zoomOut = () => {
    setZoom((prev) => Math.max(0.6, Number((prev - 0.2).toFixed(2))))
  }

  const resetZoom = () => {
    setZoom(1)
  }

  const updateImageMetrics = (
    pageNumber: number,
    imageRef: React.RefObject<HTMLImageElement | null>
  ) => {
    const image = imageRef.current
    if (!image) return
    const rect = image.getBoundingClientRect()
    setImageMetrics((prev) => ({
      ...prev,
      [pageNumber]: { width: rect.width, height: rect.height },
    }))
  }

  const handleLoupeMove = (
    event: React.MouseEvent,
    src: string,
    imageRef: React.RefObject<HTMLImageElement | null>
  ) => {
    if (!loupeEnabled || drawState) return
    const container = event.currentTarget as HTMLDivElement
    const containerRect = container.getBoundingClientRect()
    const image = imageRef.current
    if (!image) return
    const imageRect = image.getBoundingClientRect()
    const imageX = event.clientX - imageRect.left
    const imageY = event.clientY - imageRect.top
    if (
      imageX < 0 ||
      imageY < 0 ||
      imageX > imageRect.width ||
      imageY > imageRect.height
    ) {
      setLoupeState((prev) => ({ ...prev, visible: false }))
      return
    }
    const x = event.clientX - containerRect.left
    const y = event.clientY - containerRect.top
    setLoupeState({
      visible: true,
      x,
      y,
      imageX,
      imageY,
      imageWidth: imageRect.width,
      imageHeight: imageRect.height,
      src,
    })
  }

  const handleLoupeLeave = () => {
    setLoupeState((prev) => ({ ...prev, visible: false }))
  }

  const loupeScale = 2.4
  const loupeSize = 180
  const loupeRadius = loupeSize / 2

  const handleDrawStart = (
    event: React.MouseEvent,
    pageNumber: number,
    imageRef: React.RefObject<HTMLImageElement | null>
  ) => {
    if (activeTool !== 'highlight' && activeTool !== 'note') return
    const image = imageRef.current
    if (!image) return
    const rect = image.getBoundingClientRect()
    const imageX = event.clientX - rect.left
    const imageY = event.clientY - rect.top
    if (imageX < 0 || imageY < 0 || imageX > rect.width || imageY > rect.height) return
    setDrawState({
      pageNumber,
      startX: imageX,
      startY: imageY,
      currentX: imageX,
      currentY: imageY,
      imageWidth: rect.width,
      imageHeight: rect.height,
      type: activeTool,
    })
  }

  const handleDrawMove = (
    event: React.MouseEvent,
    pageNumber: number,
    imageRef: React.RefObject<HTMLImageElement | null>
  ) => {
    if (!drawState || drawState.pageNumber !== pageNumber) return
    const image = imageRef.current
    if (!image) return
    const rect = image.getBoundingClientRect()
    const imageX = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
    const imageY = Math.min(Math.max(event.clientY - rect.top, 0), rect.height)
    setDrawState((prev) =>
      prev
        ? {
            ...prev,
            currentX: imageX,
            currentY: imageY,
            imageWidth: rect.width,
            imageHeight: rect.height,
          }
        : prev
    )
  }

  const handleDrawEnd = async () => {
    if (!drawState || !id) return
    const {
      pageNumber,
      startX,
      startY,
      currentX,
      currentY,
      imageWidth,
      imageHeight,
      type,
    } = drawState
    setDrawState(null)

    const width = Math.abs(currentX - startX)
    const height = Math.abs(currentY - startY)
    if (width < 6 || height < 6) return

    let content = ''
    if (type === 'note') {
      const response = window.prompt('Note text (optional):', '')
      if (response === null) return
      content = response
    }

    const minX = Math.min(startX, currentX)
    const minY = Math.min(startY, currentY)
    const maxY = Math.max(startY, currentY)
    const lineHeight = Math.max(18, Math.min(28, imageHeight * 0.03))
    const totalHeight = maxY - minY
    const lineCount = Math.max(1, Math.round(totalHeight / lineHeight))
    const highlightHeight = Math.max(totalHeight / lineCount, lineHeight)

    const segments = Array.from({ length: lineCount }, (_, index) => {
      const segmentY = minY + index * highlightHeight
      const segmentHeight = Math.min(highlightHeight, imageHeight - segmentY)
      return {
        x: minX / imageWidth,
        y: segmentY / imageHeight,
        width: width / imageWidth,
        height: segmentHeight / imageHeight,
      }
    })

    try {
      const payloads = segments.map((position) => ({
        documentId: id,
        userId: resolveUserId(),
        campaignId: resolveCampaignId(),
        pageNumber,
        position,
        type,
        content,
        color: type === 'note' ? '#7DD3FC' : '#FDE68A',
        isShared: false,
      }))
      const responses = await Promise.all(
        payloads.map((payload) =>
          fetch(`/api/documents/${id}/annotations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).then(async (response) => {
            const body = await response.json()
            if (!response.ok) {
              throw new Error(body.error || 'Failed to create annotation')
            }
            return body
          })
        )
      )
      setAnnotations((prev) => [...responses, ...prev])
    } catch (err) {
      setToolNotice(err instanceof Error ? err.message : 'Failed to create annotation')
    }
  }

  useEffect(() => {
    if (leftPage?.pageNumber) {
      updateImageMetrics(leftPage.pageNumber, leftImageRef)
    }
    if (rightPage?.pageNumber) {
      updateImageMetrics(rightPage.pageNumber, rightImageRef)
    }
  }, [zoom, leftPage?.pageNumber, rightPage?.pageNumber])

  if (loading) {
    return <div className="p-6">Loading reader...</div>
  }

  if (error) {
    return <div className="p-6 text-red-600">Reader error: {error}</div>
  }

  if (!data || pages.length === 0) {
    return <div className="p-6">No page images available for this document.</div>
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="max-w-6xl mx-auto p-6">
        <div className="sticky top-4 z-10 flex justify-center mb-4">
          <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white/90 px-3 py-2 shadow-sm">
            <button
              onClick={zoomOut}
              className="px-2 py-1 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
              title="Zoom out"
            >
              Zoom-
            </button>
            <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button
              onClick={zoomIn}
              className="px-2 py-1 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
              title="Zoom in"
            >
              Zoom+
            </button>
            <button
              onClick={resetZoom}
              className="px-2 py-1 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-100"
              title="Reset zoom"
            >
              Reset
            </button>
            <div className="h-6 w-px bg-slate-200" />
            <button
              onClick={() => setLoupeEnabled((prev) => !prev)}
              className={`px-2 py-1 text-sm rounded-md border ${loupeEnabled ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              title="Toggle loupe"
            >
              Loupe
            </button>
            <button
              onClick={() => setActiveTool('pan')}
              className={`px-2 py-1 text-sm rounded-md border ${activeTool === 'pan' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              title="Pan tool"
            >
              Hand
            </button>
            <button
              onClick={() => setActiveTool('highlight')}
              className={`px-2 py-1 text-sm rounded-md border ${activeTool === 'highlight' ? 'border-amber-500 bg-amber-500 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              title="Highlight tool"
            >
              Highlight
            </button>
            <button
              onClick={() => setActiveTool('note')}
              className={`px-2 py-1 text-sm rounded-md border ${activeTool === 'note' ? 'border-sky-500 bg-sky-500 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              title="Note tool"
            >
              Note
            </button>
            <button
              onClick={() => setActiveTool('bookmark')}
              className={`px-2 py-1 text-sm rounded-md border ${activeTool === 'bookmark' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}
              title="Bookmark tool"
            >
              Bookmark
            </button>
          </div>
        </div>
        {toolNotice && (
          <div className="mb-4 text-sm text-rose-600">{toolNotice}</div>
        )}

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{data.title}</h1>
            <p className="text-sm text-slate-500">
              Pages {leftPage?.pageNumber ?? leftIndex + 1}
              {rightPage ? `–${rightPage.pageNumber ?? leftIndex + 2}` : ''} of {pages.length}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={goPrev}
              disabled={leftIndex === 0}
              className="px-4 py-2 rounded-md bg-white border border-slate-300 text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={goNext}
              disabled={leftIndex >= maxLeftIndex}
              className="px-4 py-2 rounded-md bg-slate-900 text-white disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow-lg rounded-xl p-4">
            {leftPage ? (
              <div
                className={`relative rounded-lg overflow-auto max-h-[75vh] ${activeTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'}`}
                onMouseMove={(event) => {
                  handleLoupeMove(event, leftPage.url, leftImageRef)
                  handleDrawMove(event, leftPage.pageNumber ?? leftIndex + 1, leftImageRef)
                }}
                onMouseLeave={handleLoupeLeave}
                onMouseDown={(event) => handleDrawStart(event, leftPage.pageNumber ?? leftIndex + 1, leftImageRef)}
                onMouseUp={handleDrawEnd}
                onClick={() => handlePageClick(leftPage.pageNumber ?? leftIndex + 1)}
              >
                <img
                  src={leftPage.url}
                  alt={`Page ${leftPage.pageNumber ?? leftIndex + 1}`}
                  ref={leftImageRef}
                  className="w-full h-auto rounded-lg origin-top-left"
                  style={{ transform: `scale(${zoom})` }}
                  onLoad={() =>
                    updateImageMetrics(leftPage.pageNumber ?? leftIndex + 1, leftImageRef)
                  }
                />
                {imageMetrics[leftPage.pageNumber ?? leftIndex + 1] &&
                  annotations
                    .filter((annotation) => annotation.pageNumber === (leftPage.pageNumber ?? leftIndex + 1))
                    .map((annotation) => {
                      const metrics = imageMetrics[leftPage.pageNumber ?? leftIndex + 1]
                      const width = (annotation.position.width ?? 0) * metrics.width
                      const height = (annotation.position.height ?? 0) * metrics.height
                      return (
                        <div
                          key={annotation.id}
                          className="absolute rounded-sm"
                          title={annotation.type === 'note' ? annotation.content : 'Highlight'}
                          style={{
                            left: annotation.position.x * metrics.width,
                            top: annotation.position.y * metrics.height,
                            width,
                            height,
                            backgroundColor:
                              annotation.type === 'note'
                                ? 'rgba(125, 211, 252, 0.35)'
                                : 'rgba(253, 230, 138, 0.45)',
                            border:
                              annotation.type === 'note'
                                ? '1px solid rgba(56, 189, 248, 0.8)'
                                : '1px solid rgba(251, 191, 36, 0.7)',
                          }}
                        >
                          {annotation.type === 'note' && annotation.content && (
                            <span className="absolute -top-2 left-0 text-[10px] bg-sky-500 text-white px-1 rounded">
                              Note
                            </span>
                          )}
                        </div>
                      )
                    })}
                {drawState && drawState.pageNumber === (leftPage.pageNumber ?? leftIndex + 1) && (
                  <div
                    className="absolute rounded-sm border border-amber-500 bg-amber-200/40"
                    style={{
                      left: Math.min(drawState.startX, drawState.currentX),
                      top: Math.min(drawState.startY, drawState.currentY),
                      width: Math.abs(drawState.currentX - drawState.startX),
                      height: Math.abs(drawState.currentY - drawState.startY),
                    }}
                  />
                )}
                {loupeEnabled && loupeState.visible && loupeState.src === leftPage.url && (
                  <div
                    className="pointer-events-none absolute border-2 border-slate-900 rounded-full shadow-lg"
                    style={{
                      width: loupeSize,
                      height: loupeSize,
                      left: loupeState.x - loupeRadius,
                      top: loupeState.y - loupeRadius,
                      backgroundImage: `url(${loupeState.src})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: `${loupeState.imageWidth * loupeScale}px ${loupeState.imageHeight * loupeScale}px`,
                      backgroundPosition: `${-loupeState.imageX * loupeScale + loupeRadius}px ${
                        -loupeState.imageY * loupeScale + loupeRadius
                      }px`,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400">No page</div>
            )}
          </div>
          <div className="bg-white shadow-lg rounded-xl p-4">
            {rightPage ? (
              <div
                className={`relative rounded-lg overflow-auto max-h-[75vh] ${activeTool === 'pan' ? 'cursor-grab' : 'cursor-crosshair'}`}
                onMouseMove={(event) => {
                  handleLoupeMove(event, rightPage.url, rightImageRef)
                  handleDrawMove(event, rightPage.pageNumber ?? leftIndex + 2, rightImageRef)
                }}
                onMouseLeave={handleLoupeLeave}
                onMouseDown={(event) => handleDrawStart(event, rightPage.pageNumber ?? leftIndex + 2, rightImageRef)}
                onMouseUp={handleDrawEnd}
                onClick={() => handlePageClick(rightPage.pageNumber ?? leftIndex + 2)}
              >
                <img
                  src={rightPage.url}
                  alt={`Page ${rightPage.pageNumber ?? leftIndex + 2}`}
                  ref={rightImageRef}
                  className="w-full h-auto rounded-lg origin-top-left"
                  style={{ transform: `scale(${zoom})` }}
                  onLoad={() =>
                    updateImageMetrics(rightPage.pageNumber ?? leftIndex + 2, rightImageRef)
                  }
                />
                {imageMetrics[rightPage.pageNumber ?? leftIndex + 2] &&
                  annotations
                    .filter((annotation) => annotation.pageNumber === (rightPage.pageNumber ?? leftIndex + 2))
                    .map((annotation) => {
                      const metrics = imageMetrics[rightPage.pageNumber ?? leftIndex + 2]
                      const width = (annotation.position.width ?? 0) * metrics.width
                      const height = (annotation.position.height ?? 0) * metrics.height
                      return (
                        <div
                          key={annotation.id}
                          className="absolute rounded-sm"
                          title={annotation.type === 'note' ? annotation.content : 'Highlight'}
                          style={{
                            left: annotation.position.x * metrics.width,
                            top: annotation.position.y * metrics.height,
                            width,
                            height,
                            backgroundColor:
                              annotation.type === 'note'
                                ? 'rgba(125, 211, 252, 0.35)'
                                : 'rgba(253, 230, 138, 0.45)',
                            border:
                              annotation.type === 'note'
                                ? '1px solid rgba(56, 189, 248, 0.8)'
                                : '1px solid rgba(251, 191, 36, 0.7)',
                          }}
                        >
                          {annotation.type === 'note' && annotation.content && (
                            <span className="absolute -top-2 left-0 text-[10px] bg-sky-500 text-white px-1 rounded">
                              Note
                            </span>
                          )}
                        </div>
                      )
                    })}
                {drawState && drawState.pageNumber === (rightPage.pageNumber ?? leftIndex + 2) && (
                  <div
                    className="absolute rounded-sm border border-amber-500 bg-amber-200/40"
                    style={{
                      left: Math.min(drawState.startX, drawState.currentX),
                      top: Math.min(drawState.startY, drawState.currentY),
                      width: Math.abs(drawState.currentX - drawState.startX),
                      height: Math.abs(drawState.currentY - drawState.startY),
                    }}
                  />
                )}
                {loupeEnabled && loupeState.visible && loupeState.src === rightPage.url && (
                  <div
                    className="pointer-events-none absolute border-2 border-slate-900 rounded-full shadow-lg"
                    style={{
                      width: loupeSize,
                      height: loupeSize,
                      left: loupeState.x - loupeRadius,
                      top: loupeState.y - loupeRadius,
                      backgroundImage: `url(${loupeState.src})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: `${loupeState.imageWidth * loupeScale}px ${loupeState.imageHeight * loupeScale}px`,
                      backgroundPosition: `${-loupeState.imageX * loupeScale + loupeRadius}px ${
                        -loupeState.imageY * loupeScale + loupeRadius
                      }px`,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400">End of book</div>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-white shadow-sm border border-slate-200 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">Page Jump</span>
            <span className="text-xs text-slate-400">Bookmarks: {bookmarks.length}</span>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {pages.map((page, index) => {
                const pageNumber = page.pageNumber ?? index + 1
                const isActive = pageNumber === (leftPage?.pageNumber ?? leftIndex + 1) || pageNumber === (rightPage?.pageNumber ?? leftIndex + 2)
                const isBookmarked = bookmarks.some((bookmark) => bookmark.pageNumber === pageNumber)
                return (
                  <button
                    key={page.key}
                    onClick={() => jumpToPage(pageNumber)}
                    className={`relative px-2 py-1 rounded-md text-xs border ${
                      isActive ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                    title={`Go to page ${pageNumber}`}
                  >
                    {pageNumber}
                    {isBookmarked && (
                      <span className="absolute -top-2 right-1 text-rose-600">🔖</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
