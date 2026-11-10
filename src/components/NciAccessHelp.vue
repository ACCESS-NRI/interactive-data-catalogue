<template>
  <details class="text-sm text-gray-600 dark:text-gray-300">
    <summary class="w-fit cursor-pointer font-medium text-blue-700 dark:text-blue-300">
      How to download with THREDDS or Globus
    </summary>
    <div class="mt-3 max-w-3xl space-y-3">
      <p>
        <strong>THREDDS:</strong> open the link beside a path. For a directory, select a file; then use its
        <strong>HTTPServer</strong> link to download it, or <strong>OPENDAP</strong> to access it remotely.
      </p>
      <p><strong>Globus:</strong> use it to transfer files to another computer or research storage collection.</p>
      <ol class="list-decimal space-y-1 pl-5">
        <li>Open a Globus folder link and sign in. The source collection and folder are filled in for you.</li>
        <li>
          Select the files you need and check their version and time range. The folder may also contain files outside
          your search filters.
        </li>
        <li>
          Choose a destination collection and folder you can write to. For your own computer, set up Globus Connect
          Personal first.
        </li>
        <li>Choose Start to begin the transfer, then follow its progress in Activity.</li>
      </ol>
      <p>
        If there is no Globus link, check the dataset's ESGF page for a published Globus option or ask NCI support for
        the collection link. A Gadi path alone is not a Globus address. Access depends on the collection's permissions
        and availability.
      </p>
      <p>
        <a
          href="https://docs.globus.org/guides/tutorials/manage-files/transfer-files/"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-700 underline dark:text-blue-300"
          >Globus transfer walkthrough ↗</a
        >
        ·
        <a
          href="https://www.globus.org/globus-connect-personal"
          target="_blank"
          rel="noopener noreferrer"
          class="text-blue-700 underline dark:text-blue-300"
          >Set up Globus Connect Personal ↗</a
        >
      </p>
    </div>
  </details>
</template>
