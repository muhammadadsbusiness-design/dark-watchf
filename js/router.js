/**
 * Dark Watch - Client Hash Router
 * Lightweight, fast client-side router supporting parameters and route changes.
 */

export class Router {
  constructor(routes, notFoundHandler) {
    this.routes = routes;
    this.notFoundHandler = notFoundHandler;
    this.currentRoute = null;
    this.params = {};

    window.addEventListener('hashchange', () => this.handleRoute());
    window.addEventListener('load', () => this.handleRoute());
  }

  handleRoute() {
    let hash = window.location.hash.slice(1) || '/';
    // Remove query params from path matching
    const [path, queryString] = hash.split('?');
    const queryParams = new URLSearchParams(queryString || '');

    // Match exact or parameterized route
    for (const route of this.routes) {
      const match = this.matchRoute(route.pattern, path);
      if (match) {
        this.currentRoute = route;
        this.params = match.params;
        route.handler(this.params, queryParams);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.updateNavActiveState(path);
        return;
      }
    }

    if (this.notFoundHandler) {
      this.notFoundHandler();
    }
  }

  matchRoute(pattern, path) {
    const patternParts = pattern.split('/').filter(Boolean);
    const pathParts = path.split('/').filter(Boolean);

    if (patternParts.length !== pathParts.length) {
      return null;
    }

    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        const paramName = patternParts[i].slice(1);
        params[paramName] = decodeURIComponent(pathParts[i]);
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }

    return { params };
  }

  updateNavActiveState(path) {
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      const cleanHref = href.replace('#', '') || '/';
      if (cleanHref === path || (path === '' && cleanHref === '/')) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  navigate(hashPath) {
    window.location.hash = hashPath.startsWith('#') ? hashPath : '#' + hashPath;
  }
}
