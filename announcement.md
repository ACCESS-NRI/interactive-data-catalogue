# Title: Introducing the ACCESS-NRI Interactive Data Catalogue

[The ACCESS-NRI Interactive Data Catalogue](https://access-nri.github.io/interactive-data-catalogue/) is a new, web based tool to explore the data products available on Gadi.

It is designed to remove as many barries to exploring and discovering data as possible, as well as getting a new user set up with the correct NCI projects & python code to load and work with the data.

The ACCESS-NRI Interactive Data Catalogue wraps _the same data catalogue_ available on Gadi as the `ACCESS-NRI Intake Catalog`, but replaces the Python API with a web based interface.

Benefits of the Interactive Data Catalogue over the Python API include:

- You _do not need to have an NCI account_ to explore the data products available on Gadi.
- You can explore whether data in a particular NCI project is relevant to your research, _before asking for permission to join the group_.
- There is no longer _any need_ to learn how to use intake. The interactive data catalogue will provide a quickstart code snippet, which will give you an xarray dataset with the data product you are interested in, ready to use in your analysis. Potentially confusing computational details are handled for you, so you can get straight to work.
- You can easily share links to a specific dataset via the interactive catalog. Specific searches generate a URL which you can share with collaborators, saving passing code snippets around.
- The interactive data catalogue will tell you which groups you must be part of to access a particular dataset, and link you to the NCI project pages where you can request access. It will also help you get started with the `conda/analysis3` python environment, if you are not already familiar with it.

### Warning

**The interactive catalogue will not let you access the underlying data through it. It is purely a tool to discover data products on Gadi. Once you have found a dataset of interest, the tool will guide you through the process of interacting with the data using an ARE session on Gadi.**

---

Although we believe it is now production ready, the interactive data catalogue is still in its early stages, and we are keen to get feedback from users on how to improve it. If you have any suggestions, questions, or comments, please [open an issue on the GitHub repository](https://github.com/ACCESS-NRI/interactive-data-catalogue) or reply to this thread.

---

Although the Interactive Data Catalogue may look like a totally new tool, it is a thin layer on top of the existing `ACCESS-NRI Intake Catalog`, which is still available for users who prefer to work with a Python API. The two tools are designed to be complementary, and we will continue to maintain both moving forward.

Credit goes to the developers of those tools (intake, intake-esm, and access-nri-intake) for producing a data structure that allowed for the creation of the interactive data catalogue.

We also thank everyone who has contributed feedback during the development process, primarily during alpha testing at AMOS 2026.
