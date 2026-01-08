/**
 * Language Management Hooks
 *
 * Custom React Query hooks for language and language pair management.
 * Provides CRUD operations, caching, and real-time updates.
 */

import { useQuery, useMutation, useQueryClient } from 'react-query';
import { languageAPI } from '@/lib/api';

// Types
interface Language {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  source_pairs_count?: number;
  target_pairs_count?: number;
}

interface LanguagePair {
  id: number;
  source_language_id: number;
  target_language_id: number;
  is_bidirectional: boolean;
  is_active: boolean;
  source_language?: Language;
  target_language?: Language;
}

interface LanguageListParams {
  query?: string;
  is_active?: boolean;
  skip?: number;
  limit?: number;
}

interface LanguagePairListParams {
  source_language_id?: number;
  target_language_id?: number;
  is_active?: boolean;
  organization_id?: number;
  skip?: number;
  limit?: number;
}

// =============================================================================
// LANGUAGE HOOKS
// =============================================================================

/**
 * Hook to fetch list of languages with optional filtering
 */
export function useLanguageList(params?: LanguageListParams) {
  return useQuery(
    ['languages', 'list', params],
    () => languageAPI.getList(params),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      retryDelay: 1000,
    }
  );
}

/**
 * Hook to fetch a single language by ID
 */
export function useLanguageItem(id: number) {
  return useQuery(
    ['languages', id],
    () => languageAPI.get(id),
    {
      enabled: !!id,
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );
}

/**
 * Hook to create a new language
 */
export function useCreateLanguage() {
  const queryClient = useQueryClient();

  return useMutation(languageAPI.create, {
    onSuccess: () => {
      // Invalidate language list to refresh data
      queryClient.invalidateQueries(['languages', 'list']);
    },
    onError: (error) => {
      console.error('Error creating language:', error);
    },
  });
}

/**
 * Hook to update an existing language
 */
export function useUpdateLanguage() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ id, data }: { id: number; data: Partial<Language> }) =>
      languageAPI.update(id, data),
    {
      onSuccess: (data, variables) => {
        // Invalidate related queries
        queryClient.invalidateQueries(['languages', 'list']);
        queryClient.invalidateQueries(['languages', variables.id]);

        // Update cached item if it exists
        queryClient.setQueryData(['languages', variables.id], data);
      },
      onError: (error) => {
        console.error('Error updating language:', error);
      },
    }
  );
}

/**
 * Hook to delete a language
 */
export function useDeleteLanguage() {
  const queryClient = useQueryClient();

  return useMutation(languageAPI.delete, {
    onSuccess: () => {
      // Invalidate language list
      queryClient.invalidateQueries(['languages', 'list']);
    },
    onError: (error) => {
      console.error('Error deleting language:', error);
    },
  });
}

// =============================================================================
// LANGUAGE PAIR HOOKS
// =============================================================================

/**
 * Hook to fetch list of language pairs with optional filtering
 */
export function useLanguagePairs(params?: LanguagePairListParams) {
  return useQuery(
    ['languagePairs', 'list', params],
    () => languageAPI.getPairs(params),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );
}

/**
 * Hook to fetch a single language pair by ID
 */
export function useLanguagePair(id: number) {
  return useQuery(
    ['languagePairs', id],
    () => languageAPI.getPair(id),
    {
      enabled: !!id,
      staleTime: 10 * 60 * 1000, // 10 minutes
    }
  );
}

/**
 * Hook to create a new language pair
 */
export function useCreateLanguagePair() {
  const queryClient = useQueryClient();

  return useMutation(languageAPI.createPair, {
    onSuccess: (data) => {
      console.log('Language pair created successfully:', data);
      // Invalidate both language pairs and languages (for pair counts)
      queryClient.invalidateQueries(['languagePairs', 'list']);
      queryClient.invalidateQueries(['languages', 'list']);
    },
    onError: (error) => {
      console.error('Error creating language pair:', error);
      // Don't handle error here - let the component handle it
      // This ensures errors are properly propagated
    },
  });
}

/**
 * Hook to update an existing language pair
 */
export function useUpdateLanguagePair() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ id, data }: { id: number; data: Partial<LanguagePair> }) =>
      languageAPI.updatePair(id, data),
    {
      onSuccess: () => {
        // Invalidate related queries
        queryClient.invalidateQueries(['languagePairs', 'list']);
        queryClient.invalidateQueries(['languages', 'list']);
      },
      onError: (error) => {
        console.error('Error updating language pair:', error);
      },
    }
  );
}

/**
 * Hook to delete a language pair
 */
export function useDeleteLanguagePair() {
  const queryClient = useQueryClient();

  return useMutation(languageAPI.deletePair, {
    onSuccess: () => {
      // Invalidate both language pairs and languages
      queryClient.invalidateQueries(['languagePairs', 'list']);
      queryClient.invalidateQueries(['languages', 'list']);
    },
    onError: (error) => {
      console.error('Error deleting language pair:', error);
    },
  });
}

// =============================================================================
// UTILITY HOOKS
// =============================================================================

/**
 * Hook to fetch available target languages for a source language
 * Used in language pair creation/editing forms
 */
export function useAvailableTargetLanguages(
  sourceLanguageId: number,
  organizationId?: number
) {
  return useQuery(
    ['languages', 'availableTargets', sourceLanguageId, organizationId],
    () => languageAPI.getAvailableTargets(sourceLanguageId, organizationId),
    {
      enabled: !!sourceLanguageId && sourceLanguageId > 0,
      staleTime: 2 * 60 * 1000, // 2 minutes
      retry: 2,
      retryDelay: 1000,
    }
  );
}
