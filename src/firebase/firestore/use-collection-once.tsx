'use client';

import { useState, useEffect } from 'react';
import {
  Query,
  getDocs,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
export type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useCollectionOnce hook.
 * @template T Type of the document data.
 */
export interface UseCollectionOnceResult<T> {
  data: WithId<T>[] | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
  refetch: () => Promise<void>; // Function to manually trigger a refetch.
}

/**
 * Internal implementation of Query (for permission error path extraction)
 */
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * React hook to fetch a Firestore collection or query ONCE.
 * Useful for reducing costs when real-time updates are not necessary.
 * 
 * @template T Optional type for document data. Defaults to any.
 * @param {CollectionReference<DocumentData> | Query<DocumentData> | null | undefined} targetRefOrQuery -
 * The Firestore CollectionReference or Query.
 * @returns {UseCollectionOnceResult<T>} Object with data, isLoading, error.
 */
export function useCollectionOnce<T = any>(
    memoizedTargetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>) & {__memo?: boolean})  | null | undefined,
): UseCollectionOnceResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  const [version, setVersion] = useState(0);

  const refetch = async () => {
    setVersion(v => v + 1);
  };

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let isMounted = true;

    async function fetchData() {
      setIsLoading(true);
      setError(null);

      try {
        const snapshot: QuerySnapshot<DocumentData> = await getDocs(memoizedTargetRefOrQuery!);
        
        if (!isMounted) return;

        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        
        setData(results);
        setError(null);
      } catch (serverError: any) {
        if (!isMounted) return;

        if (serverError.code === 'permission-denied') {
            const path: string =
              memoizedTargetRefOrQuery!.type === 'collection'
                ? (memoizedTargetRefOrQuery as CollectionReference).path
                : (memoizedTargetRefOrQuery as unknown as InternalQuery)._query.path.canonicalString()

            const contextualError = new FirestorePermissionError({
              operation: 'list',
              path,
            })

            setError(contextualError)
            errorEmitter.emit('permission-error', contextualError);
        } else {
            console.error("Firestore error in useCollectionOnce:", serverError);
            setError(serverError);
        }
        setData(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchData();
    return () => { isMounted = false; };
  }, [memoizedTargetRefOrQuery, version]); 

  if(memoizedTargetRefOrQuery && !memoizedTargetRefOrQuery.__memo) {
    throw new Error(memoizedTargetRefOrQuery + ' was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error, refetch };
}
