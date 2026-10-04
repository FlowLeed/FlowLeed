/** Base URL for links people open outside the app, such as public form, prayer and group sign-up links. */
export function publicBaseUrl(): string {
  return window.location.origin;
}

export function publicUrl(path: string): string {
  return `${publicBaseUrl()}${path}`;
}
