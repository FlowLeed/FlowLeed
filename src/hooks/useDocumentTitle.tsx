import { useEffect } from "react";
import { useProfile } from "./useProfile";

const DEFAULT_TITLE = "FlowLeed";

/** Keeps the browser tab title in sync with the current church's name. */
export const useDocumentTitle = () => {
  const { organization } = useProfile();

  useEffect(() => {
    document.title = organization?.name?.trim() || DEFAULT_TITLE;
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [organization?.name]);
};
