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
- **CMIP discovery**: One homepage card offers CMIP6 and CMIP7, searching NCI by default, with mutually exclusive NCI/ESGF choices, an ACCESS-only checkbox, and shared access code for NCI collections. Dataset results include NCI availability and errata checks.
- **Opt-in ESGF discovery in individual collections**: CMIP6 and CMIP7 replica collections can also search ESGF alongside local results.

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

The **Explore CMIP6 and CMIP7** homepage card opens `/cmip`, defaulting to CMIP7 and **Search on NCI**. The **CMIP era** selector offers CMIP6 and CMIP7. **Search on NCI** and **Search ESGF** are mutually exclusive; the separate **Only ACCESS data** checkbox applies to either location. ESGF mode explains that files absent from NCI need downloading and recommends searching NCI first when working on Gadi. An empty NCI search offers **Try searching ESGF**, preserving the era, ACCESS choice and selected filters. Failed or pending collection queries are not treated as empty results.

Changing era keeps the location and ACCESS choice but clears filters because model names and facets differ. Old `/cmip7` and `/cmip6` links redirect with their query parameters intact. `nci=false` explicitly selects ESGF; `nci=true` or an omitted `nci` parameter selects NCI. The era, search location, ACCESS choice and filters are preserved in shared URLs, and changing location cancels outstanding searches.

NCI searches the Australian submissions and ESGF replicas catalogues, with one table interleaving up to ten local file records from each collection per page, shared pagination, and links to each collection's access code. Counts describe file records per collection, not unique datasets; a dataset can span several files or be present in both collections. A failed collection remains visibly incomplete and blocks forward paging until retried. Model names come from collection-wide facets, not the loaded result page. Existing model selections are intersected with ACCESS models; a selection with no ACCESS models shows no matches rather than broadening the search. A failed facet lookup blocks ACCESS-only searches until retried.

The **Access data on NCI** panel has visible **Intake + Xarray**, **ESMValCore**, and **ESMValTool** tabs. Its explanation changes with the search location: all examples read files held on Gadi and do not download the ESGF result list. It lists both included collections and generates code from the effective filters, including the ACCESS choice, for both NCI collections of the selected era:

- CMIP6: `cmip6_fs38` and `cmip6_oi10`.
- CMIP7: `cmip7_australian` and `cmip7_replicated`.

The Intake + Xarray example includes ARE JupyterLab launch settings for the xp65 `conda/analysis3` environment, the appropriate storage projects, and a link to the ACCESS-Hive setup instructions. It explains that `re` is built into Python and matches selected filter values exactly. Intake searches each catalogue with exact values, retains its aggregation rules, and prefixes dataset keys with the collection name to avoid overwrites. ESMValCore expands selected facets into scalar queries and loads the matching datasets as separate Iris cubes. CMIP7 short names stay paired with their branding suffixes. ESMValTool provides a preprocessing recipe, a `cmip-config/data.yml` configuration, and the command to run them. Its recipe requires a selected variable and one CMIP6 table or CMIP7 realm (plus branded variable); missing values are marked for editing. Unsupported ESMVal filters are flagged and code copying is disabled until they are removed.

Both ESMVal examples configure the publication and replica roots using the current [ESMValCore data-source format](https://docs.esmvaltool.org/projects/ESMValCore/en/latest/quickstart/configure.html) and `search_data: complete`, so a match in one collection does not stop the other being searched. They require a current environment with support for the chosen CMIP version. All three examples run against files on Gadi; they do not download ESGF-only results. The panel lists the required NCI storage projects. Generated Python is exercised with API doubles in tests; actual data loading requires the relevant Gadi environment and memberships.

Individual datastore links remain available for existing bookmarks and access code:

In `cmip6_oi10` or `cmip7_replicated`, tick **Also search ESGF** below the filters. This uses the current filters and adds ESGF values to the existing searchable dropdowns. Values absent from the local collection carry an **ESGF** label. Choices come from collection-wide facet queries, independently of the loaded results page, and are cached for the current view. CMIP6 uses Solr facets; CMIP7 uses STAC aggregations. No ESGF request is made until opted in. Switching it off cancels pending requests and removes the extra choices while preserving selected filters. Failed facet lookups leave NCI choices available with a retry option. Changing filters cancels pending dataset searches and discards stale results.

ESGF datasets appear in an additional results table above the existing NCI file table. Results are paged in batches of ten index records and replicas are grouped by versioned dataset ID. Counts from the two sources are not added together because they describe different units. Filters unsupported by ESGF (such as local file time ranges) explicitly block the external search instead of being silently ignored.

The **Also search ESGF** checkbox adds a violet international-data panel alongside the blue NCI local-files panel. NCI results, paths and quick-start code remain available. Unchecking the box cancels external searches and removes the additional ESGF results and filter choices.

CMIP6 uses the [ESGF Solr search API](https://esgf.github.io/esg-search/ESGF_Search_RESTful_API.html) at CEDA. CMIP7 uses the STAC endpoint configured by [NCI Metagrid](https://esgf.nci.org.au/frontend-config.js). Both public endpoints support browser CORS. Override them at build time with `VITE_ESGF_CMIP6_SEARCH_URL` and `VITE_ESGF_CMIP7_SEARCH_URL` (a full search URL, including `/search`). A replacement endpoint must support CORS or be served through a same-origin proxy available in production.

Availability is checked against both the replicas and Australian submissions catalogues, using all dataset identity fields rather than just the displayed local page. CMIP6 distinguishes matching and different versions. CMIP7 catalogue records currently omit version, so matches are labelled **version unverified**. A successful zero-match check in both collections is labelled **Not found in NCI catalogue**; failed checks or incomplete identity metadata remain **unverified**. These checks do not establish file completeness, instantaneous disk availability, or the replication queue, and catalogue snapshots may lag publication.

Replication requests are not available yet. Datasets confirmed missing from both NCI catalogues show this message. No request action, draft or submission link is provided; ESGF links remain available for inspecting datasets.

ESGF results also check the [ESGF Errata Service](https://ipsl.gitbook.io/esgf-errata-service/errata-service-api) for the exact displayed dataset version, including datasets found at NCI. **Errata reported** highlights affected versions and links to the issue records; consult those records for severity and resolution. PID records can omit published issues, so negative or unresolved PID lookups are cross-checked against the issue catalogue by model, experiment and (for CMIP6) table. Each candidate issue must explicitly list the exact dataset version. The variable facet is deliberately omitted because it is absent from some published issue metadata. **No errata reported for this version** requires both a negative PID result and a complete issue-catalogue check; incomplete or failed checks remain **Errata unverified**. In particular, some CMIP7 identifiers are not yet resolvable by the service. Checks run only while ESGF results are enabled, with at most two errata requests at once and successful responses cached for the current view. **Refresh ESGF results** repeats the checks. The public CORS-enabled endpoint defaults to `https://errata.esgf.io/1/resolve/simple-pid`; override the full URL with `VITE_ESGF_ERRATA_URL` if a deployment needs a compatible proxy.

Issue catalogue requests and affected-dataset lists are shared within each search to avoid repeated downloads. Override the catalogue API base with `VITE_ESGF_ERRATA_CATALOGUE_URL` (default `https://errata.esgf.io/2/`). A live example is `CMIP6.CMIP.MOHC.UKESM1-0-LL.historical.r1i1p1f2.AERmon.emidust.gn.v20190406`: its PID reports no errata, but [the published dust-flux interpretation issue](https://errata.esgf.io/static/view.html?uid=89a13e84-47f1-a04d-a6c9-e0ac0330c769) explicitly lists that version and is shown as **Errata reported**.
