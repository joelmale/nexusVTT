import WebSocket from 'ws';
import { prisma } from '../services/database.service';
import { sessionService } from '../services/session.service';
import {
  AnnotationCreatePayload,
  AnnotationUpdatePayload,
  AnnotationDeletePayload,
  OutgoingEventType,
  AnnotationCreatePayloadSchema,
  AnnotationUpdatePayloadSchema,
  AnnotationDeletePayloadSchema,
} from '../types/events';

/**
 * Handle annotation create (real-time)
 */
export async function handleAnnotationCreate(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: AnnotationCreatePayload = AnnotationCreatePayloadSchema.parse(data);

    // Verify session exists
    const session = await sessionService.getSession(payload.sessionId);
    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Create annotation in database
    const annotation = await prisma.documentAnnotation.create({
      data: {
        documentId: payload.annotation.documentId,
        referenceId: payload.annotation.referenceId || null,
        userId: payload.annotation.userId,
        campaignId: payload.annotation.campaignId || null,
        pageNumber: payload.annotation.pageNumber,
        position: payload.annotation.position,
        type: payload.annotation.type,
        content: payload.annotation.content,
        color: payload.annotation.color,
        isShared: payload.annotation.isShared,
      },
    });

    // Broadcast to all in session
    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.ANNOTATION_CREATED,
        data: { annotation },
      })
    );

    console.log(`Annotation ${annotation.id} created in session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error creating annotation:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to create annotation', error: error.message },
      })
    );
  }
}

/**
 * Handle annotation update (real-time)
 */
export async function handleAnnotationUpdate(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: AnnotationUpdatePayload = AnnotationUpdatePayloadSchema.parse(data);

    // Verify session exists
    const session = await sessionService.getSession(payload.sessionId);
    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Check if annotation exists
    const existingAnnotation = await prisma.documentAnnotation.findUnique({
      where: { id: payload.annotationId },
    });

    if (!existingAnnotation) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Annotation not found' },
        })
      );
      return;
    }

    // Update annotation
    const annotation = await prisma.documentAnnotation.update({
      where: { id: payload.annotationId },
      data: {
        ...(payload.updates.content !== undefined && { content: payload.updates.content }),
        ...(payload.updates.color !== undefined && { color: payload.updates.color }),
        ...(payload.updates.position !== undefined && { position: payload.updates.position }),
        ...(payload.updates.isShared !== undefined && { isShared: payload.updates.isShared }),
      },
    });

    // Broadcast to all in session
    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.ANNOTATION_UPDATED,
        data: { annotation },
      })
    );

    console.log(`Annotation ${annotation.id} updated in session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error updating annotation:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to update annotation', error: error.message },
      })
    );
  }
}

/**
 * Handle annotation delete (real-time)
 */
export async function handleAnnotationDelete(
  ws: WebSocket,
  data: unknown,
  broadcast: (sessionId: string, message: string, exclude?: WebSocket) => void
): Promise<void> {
  try {
    const payload: AnnotationDeletePayload = AnnotationDeletePayloadSchema.parse(data);

    // Verify session exists
    const session = await sessionService.getSession(payload.sessionId);
    if (!session) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Session not found' },
        })
      );
      return;
    }

    // Check if annotation exists
    const existingAnnotation = await prisma.documentAnnotation.findUnique({
      where: { id: payload.annotationId },
    });

    if (!existingAnnotation) {
      ws.send(
        JSON.stringify({
          type: OutgoingEventType.ERROR,
          data: { message: 'Annotation not found' },
        })
      );
      return;
    }

    // Delete annotation
    await prisma.documentAnnotation.delete({
      where: { id: payload.annotationId },
    });

    // Broadcast to all in session
    broadcast(
      payload.sessionId,
      JSON.stringify({
        type: OutgoingEventType.ANNOTATION_DELETED,
        data: { annotationId: payload.annotationId },
      })
    );

    console.log(`Annotation ${payload.annotationId} deleted in session ${payload.sessionId}`);
  } catch (error: any) {
    console.error('Error deleting annotation:', error.message);
    ws.send(
      JSON.stringify({
        type: OutgoingEventType.ERROR,
        data: { message: 'Failed to delete annotation', error: error.message },
      })
    );
  }
}
