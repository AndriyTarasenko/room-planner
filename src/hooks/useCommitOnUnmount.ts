import { type RefObject, useEffect, useRef } from 'react';

/**
 * Commits a pending draft when the field unmounts. Selecting another object re-renders the
 * inspector before the input's blur fires, which would otherwise drop an unfinished edit.
 */
export function useCommitOnUnmount(draftRef: RefObject<string | null>, commit: (draft: string) => void) {
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    return () => {
      // Reading the latest draft at unmount time is the point of this hook.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const draft = draftRef.current;
      if (draft !== null) commitRef.current(draft);
    };
  }, [draftRef]);
}
