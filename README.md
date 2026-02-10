# Interactive Catalogue SPA

An interactive web application for browsing and exploring the ACCESS-NRI intake catalog. This Vue 3 + TypeScript application provides a user-friendly interface for discovering Earth System Model (ESM) datasets with advanced filtering, searching, and data preview capabilities.

https://charles-turner-1.github.io/catalog-viewer-spa/

## Features

- **Interactive Catalogue Browsing**: Browse the complete ACCESS-NRI intake catalogue with a responsive data table
- **Advanced Filtering**: Filter datasets by model, realm, frequency, and variables. Filtering composes, so when you apply filters, the remaining filters available will be intelligently pruned.
- **Datastore Details**: Click through to individual datastores to explore their structure and data
- **Prefetching & Caching**: Intelligent data prefetching and caching for performance
- **Quick Start Code**: Generate Python code snippets for accessing datasets via intake
- **Dark Mode Support**: Toggle between light and dark themes

## Limitations

- You will still require Gadi access to get your hands on the data.
- NCI managed datastores (eg. `era5_rt52`, `cmip6_fs38`) currently unsupported.

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
