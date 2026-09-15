import { create } from 'zustand'

/** Shared between OpenApiPage and DocumentationPage so "Generate Documentation" /
 * a tag click can hand off which spec (and tag) the Documentation viewer opens to. */
interface OpenApiUiState {
  selectedSpecId: string | null
  docsTag: string | null
  setSelectedSpec(id: string | null): void
  openDocs(specId: string, tag?: string | null): void
}

export const useOpenApiUi = create<OpenApiUiState>()((set) => ({
  selectedSpecId: null,
  docsTag: null,
  setSelectedSpec: (id) => set({ selectedSpecId: id }),
  openDocs: (specId, tag = null) => set({ selectedSpecId: specId, docsTag: tag }),
}))
