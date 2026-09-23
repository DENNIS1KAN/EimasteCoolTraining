/**
 * Once the invite is claimed, the address bar shows the app's home ("#/") instead of the join link, without
 * leaving this page: "Add to Home Screen" on the welcome step then saves the app itself, and the icon never
 * reopens a spent invite. (The manifest's start_url is the app root too; some browsers use the current address.)
 */
export function forgetJoinLink(): void {
  try {
    const { pathname, search } = window.location
    window.history.replaceState(window.history.state, '', `${pathname}${search}#/`)
  } catch {
    /* sandboxed frames: nothing to tidy */
  }
}
