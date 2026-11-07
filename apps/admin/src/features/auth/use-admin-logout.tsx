import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog";
import { Button } from "../../components/ui/button";
import { logoutAdmin } from "../../lib/admin-api";

function useAdminLogout(onLogout: () => void, buttons: RefObject<HTMLButtonElement | null>[]) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);
  const confirmed = useRef(false);
  const origin = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onLogoutRef = useRef(onLogout);
  const buttonsRef = useRef(buttons);
  onLogoutRef.current = onLogout;
  buttonsRef.current = buttons;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function requestLogout(button?: HTMLButtonElement) {
    if (inFlight.current || !mounted.current) return;
    inFlight.current = true;
    confirmed.current = false;
    if (button) origin.current = button;
    else closeRef.current?.focus();
    setPending(true);
    let succeeded = false;
    try {
      await logoutAdmin();
      succeeded = true;
    } catch {
      if (mounted.current) setFailed(true);
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
    if (succeeded && mounted.current) {
      confirmed.current = true;
      setFailed(false);
      onLogoutRef.current();
    }
  }

  const feedback = (
    <>
      {pending && !failed ? (
        <span className="sr-only" role="status">
          正在退出登录
        </span>
      ) : null}
      <AlertDialog open={failed} onOpenChange={setFailed}>
        <AlertDialogContent
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
          size="sm"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            closeRef.current?.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            if (confirmed.current) return;
            const candidates = [origin.current, ...buttonsRef.current.map((ref) => ref.current)];
            candidates.find(isVisible)?.focus();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>未能确认退出登录</AlertDialogTitle>
            <AlertDialogDescription>未收到退出成功的确认，请稍后重试。</AlertDialogDescription>
          </AlertDialogHeader>
          {pending ? (
            <p className="sr-only" role="status">
              正在退出登录
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel ref={closeRef}>关闭</AlertDialogCancel>
            <Button aria-busy={pending} disabled={pending} onClick={() => void requestLogout()}>
              {pending ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}
              {pending ? "退出中…" : "重试退出"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
  return { pending, requestLogout, feedback };
}
function isVisible(button: HTMLButtonElement | null): button is HTMLButtonElement {
  if (!button?.isConnected) return false;
  for (let element: HTMLElement | null = button; element; element = element.parentElement) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
  }
  return true;
}
export { useAdminLogout };
