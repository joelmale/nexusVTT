import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchDocuments,
  getDocument,
  getStructuredData,
  searchStructuredData,
} from '@/services/codex-api';
import { db, CodexLink } from '@/db/schema';
import { generateId } from '@/lib/utils';

/**
 * Search documents from the codex
 */
export function useSearchDocuments(params: {
  term?: string;
  type?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['documents', 'search', params],
    queryFn: () => searchDocuments(params),
    enabled: !!params.term || !!params.type || (params.tags && params.tags.length > 0),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get a single document
 */
export function useDocument(id?: string) {
  return useQuery({
    queryKey: ['documents', id],
    queryFn: () => getDocument(id!),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get structured data for a document
 */
export function useStructuredData(documentId?: string) {
  return useQuery({
    queryKey: ['structured-data', documentId],
    queryFn: () => getStructuredData(documentId!),
    enabled: !!documentId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Search structured data (spells, monsters, items)
 */
export function useSearchStructuredData(params: {
  type?: string;
  name?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['structured-data', 'search', params],
    queryFn: () => searchStructuredData(params),
    enabled: !!params.type || !!params.name,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Link a codex document to a campaign entity
 */
export function useLinkDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      campaignId: string;
      entityType: 'npc' | 'encounter' | 'note';
      entityId: string;
      documentId: string;
      documentTitle: string;
      linkType: 'stat_block' | 'reference' | 'lore' | 'map';
      notes?: string;
    }) => {
      const link: CodexLink = {
        id: generateId(),
        campaignId: params.campaignId,
        entityType: params.entityType,
        entityId: params.entityId,
        documentId: params.documentId,
        documentTitle: params.documentTitle,
        linkType: params.linkType,
        notes: params.notes,
        createdAt: Date.now(),
      };

      await db.codexLinks.add(link);
      return link;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codex-links'] });
    },
  });
}

/**
 * Get codex links for an entity
 */
export function useCodexLinks(entityType?: string, entityId?: string) {
  return useQuery({
    queryKey: ['codex-links', entityType, entityId],
    queryFn: async () => {
      if (!entityType || !entityId) return [];

      return await db.codexLinks
        .where('[entityType+entityId]')
        .equals([entityType, entityId])
        .toArray();
    },
    enabled: !!entityType && !!entityId,
  });
}

/**
 * Get all codex links for a campaign
 */
export function useCampaignCodexLinks(campaignId?: string) {
  return useQuery({
    queryKey: ['codex-links', 'campaign', campaignId],
    queryFn: async () => {
      if (!campaignId) return [];

      return await db.codexLinks.where('campaignId').equals(campaignId).toArray();
    },
    enabled: !!campaignId,
  });
}

/**
 * Remove a codex link
 */
export function useUnlinkDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      await db.codexLinks.delete(linkId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['codex-links'] });
    },
  });
}
