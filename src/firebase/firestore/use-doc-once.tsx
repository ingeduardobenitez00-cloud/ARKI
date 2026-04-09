'use client';
    
import { useState, useEffect } from 'react';
import {
  DocumentReference,
  getDoc,
  DocumentData,
  FirestoreError,
  DocumentSnapshot,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/** Utility type to add an 'id' field to a given type T. */
type WithId<T> = T & { id: string };

/**
 * Interface for the return value of the useDocOnce hook.
 * @template T Type of the document data.
 */
export interface UseDocOnceResult<T> {
  data: WithId<T> | null; // Document data with ID, or null.
  isLoading: boolean;       // True if loading.
  error: FirestoreError | Error | null; // Error object, or null.
}

/**
 * React hook to fetch a single Firestore document ONCE.
 * Useful for reducing costs when real-time updates are not necessary.
 * 
 * @template T Optional type for document data. Defaults to any.
 * @param {DocumentReference<DocumentData> | null | undefined} docRef -
 * The Firestore DocumentReference.
 * @returns {UseDocOnceResult<T>} Object with data, isLoading, error.
 */
export function useDocOnce<T = any>(
  memoizedDocRef: (DocumentReference<DocumentData> & {__memo?: boolean}) | null | undefined,
): UseDocOnceResult<T> {
  type StateDataType = WithId<T> | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  useEffect(() => {
    if (!memoizedDocRef) {
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
        const snapshot: DocumentSnapshot<DocumentData> = await getDoc(memoizedDocRef!);
        
        if (!isMounted) return;

        if (snapshot.exists()) {
          setData({ ...(snapshot.data() as T), id: snapshot.id });
        } else {
          setData(null);
        }
        setError(null);
      } catch (serverError: any) {
        if (!isMounted) return;

        if (serverError.code === 'permission-denied') {
            const contextualError = new FirestorePermissionError({
              operation: 'get',
              path: memoizedDocRef!.path,
            })
            setError(contextualError)
            errorEmitter.emit('permission-error', contextualError);
        } else {
            console.error("Firestore error in useDocOnce:", serverError);
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

    return () => {
      isMounted = false;
    };
  }, [memoizedDocRef]);

  if(memoizedDocRef && !memoizedDocRef.__memo) {
    throw new Error(memoizedDocRef + ' was not properly memoized using useMemoFirebase');
  }

  return { data, isLoading, error };
}
