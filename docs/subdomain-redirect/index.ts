/**
 * The docs used to live at pok.danielgrant.co. They are now served at
 * notation.dev/pok, so every old URL redirects to the same path there.
 */
export default {
  fetch(request: Request): Response {
    const { pathname, search } = new URL(request.url);
    return Response.redirect(`https://notation.dev/pok${pathname}${search}`, 301);
  },
};
