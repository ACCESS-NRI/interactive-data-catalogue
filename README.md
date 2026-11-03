# Interactive Catalogue

An interactive web application for browsing and exploring the ACCESS-NRI data catalogue. This Vue 3 + TypeScript application provides a user-friendly interface for discovering Earth System Model (ESM) datasets with advanced filtering, searching, and data preview capabilities.

https://access-nri.github.io/interactive-data-catalogue/

## Features

- **Interactive Catalogue Browsing**: Browse the complete ACCESS-NRI intake catalogue with a responsive data table
- **Advanced Filtering**: Filter datasets by model, realm, frequency, and variables. Filtering composes, so when you apply filters, the remaining filters available will be intelligently pruned.
- **Datastore Details**: Click through to individual datastores to explore their structure and data
- **Prefetching & Caching**: Intelligent data prefetching and caching for performance
- **Quick Start Code**: Generate Python code snippets for accessing datasets via intake
- **Dark Mode Support**: Toggle between light and dark themes
- **Opt-in ESGF discovery**: CMIP6 and CMIP7 replica collections can search ESGF alongside local results, compare dataset identities with the NCI catalogue, and identify datasets not found at NCI.

## Limitations

- You will still require Gadi access to get your hands on the data.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Format using prettier
npm run format

# Build for production
npm run build
```

The development server proxies catalogue API requests to the hosted reporting service, so a local backend is not required.
To use a local backend instead, run `TRACKING_SERVICES_TARGET=http://127.0.0.1:8000 npm run dev`.

## ESGF discovery

In `cmip6_oi10` or `cmip7_replicated`, tick **Also search ESGF** below the filters. This uses the current filters and adds ESGF values to the existing searchable dropdowns. Values absent from the local collection carry an **ESGF** label. Choices come from collection-wide facet queries, independently of the loaded results page, and are cached for the current view. CMIP6 uses Solr facets; CMIP7 uses STAC aggregations. No ESGF request is made until opted in. Switching it off cancels pending requests and removes the extra choices while preserving selected filters; NCI-only mode also suspends ESGF requests. Failed facet lookups leave NCI choices available with a retry option. Changing filters cancels pending dataset searches and discards stale results.

ESGF datasets appear in an additional results table above the existing NCI file table. Results are paged in batches of ten index records and replicas are grouped by versioned dataset ID. Counts from the two sources are not added together because they describe different units. Filters unsupported by ESGF (such as local file time ranges) explicitly block the external search instead of being silently ignored.

Once ESGF is enabled, **NCI only / ESGF only / Both** controls which results are displayed. ESGF has a violet international-data panel; NCI has a blue local-files panel. NCI-only mode suspends external searches, while ESGF-only mode hides the local table, paths and quick-start code. Switching back preserves local table state.

CMIP6 uses the [ESGF Solr search API](https://esgf.github.io/esg-search/ESGF_Search_RESTful_API.html) at CEDA. CMIP7 uses the STAC endpoint configured by [NCI Metagrid](https://esgf.nci.org.au/frontend-config.js). Both public endpoints support browser CORS. Override them at build time with `VITE_ESGF_CMIP6_SEARCH_URL` and `VITE_ESGF_CMIP7_SEARCH_URL` (a full search URL, including `/search`). A replacement endpoint must support CORS or be served through a same-origin proxy available in production.

Availability is checked against both the replicas and Australian submissions catalogues, using all dataset identity fields rather than just the displayed local page. CMIP6 distinguishes matching and different versions. CMIP7 catalogue records currently omit version, so matches are labelled **version unverified**. A successful zero-match check in both collections is labelled **Not found in NCI catalogue**; failed checks or incomplete identity metadata remain **unverified**. These checks do not establish file completeness, instantaneous disk availability, or the replication queue, and catalogue snapshots may lag publication.

Replication requests are not available yet. Datasets confirmed missing from both NCI catalogues show this message. No request action, draft or submission link is provided; ESGF links remain available for inspecting datasets.

ESGF results also check the [ESGF Errata Service](https://ipsl.gitbook.io/esgf-errata-service/errata-service-api) for the exact displayed dataset version, including datasets found at NCI. **Errata reported** highlights affected versions and links to the issue records; consult those records for severity and resolution. A successful negative lookup shows **No errata reported for this version**, while missing PIDs, failed requests or unmatched responses show **Errata unverified**. In particular, some CMIP7 identifiers are not yet resolvable by the service. Checks run only while ESGF results are enabled, with at most two errata requests at once and successful responses cached for the current view. **Refresh ESGF results** repeats the checks. The public CORS-enabled endpoint defaults to `https://errata.esgf.io/1/resolve/simple-pid`; override the full URL with `VITE_ESGF_ERRATA_URL` if a deployment needs a compatible proxy.
