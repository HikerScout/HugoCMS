import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { DialogRenderer } from "./DialogRenderer";

const DialogContext = createContext(null);

export function DialogProvider({
  children,
}) {
  const [dialog, setDialog] = useState({
    open: false,
    type: "confirm",
    title: "",
    message: "",
  });

  const confirm = useCallback((title, message) => {
    return new Promise((resolve) => {
      setDialog({
        open: true,
        type: "confirm",
        title,
        message,
        resolve,
      });
    });
  }, []);

  const prompt = useCallback(
    (title, message, defaultValue = "") => {
      return new Promise((resolve) => {
        setDialog({
          open: true,
          type: "prompt",
          title,
          message,
          defaultValue,
          resolve,
        });
      });
    },
    []
  );

  const value = useMemo(
    () => ({
      confirm,
      prompt,
    }),
    [confirm, prompt]
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      <DialogRenderer
        dialog={dialog}
        close={() =>
          setDialog((d) => ({
            ...d,
            open: false,
          }))
        }
      />
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);

  if (!ctx) {
    throw new Error(
      "useDialog must be used inside DialogProvider"
    );
  }

  return ctx;
}
