/**
 * Product release shown in the top nav and footer.
 * Change RELEASE_VERSION here; both surfaces read this value.
 */
export const RELEASE_VERSION = '2.0';

export const releaseLabel = (version = RELEASE_VERSION) => `v${version}`;
