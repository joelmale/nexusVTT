import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import { themes as prismThemes } from 'prism-react-renderer';

const repositoryUrl = 'https://github.com/joelmale/nexusVTT';

const config: Config = {
  title: 'Nexus Documentation',
  tagline: 'Architecture, operations, and contributor guides for Nexus',
  favicon: 'img/favicon.ico',
  url: 'https://joelmale.github.io',
  baseUrl: '/nexusVTT/',
  organizationName: 'joelmale',
  projectName: 'nexusVTT',
  onBrokenLinks: 'throw',
  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],
  future: {
    v4: true,
  },
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: false,
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'platform',
        path: 'platform',
        routeBasePath: 'platform',
        sidebarPath: './sidebars.ts',
        editUrl: `${repositoryUrl}/edit/master/apps/docs/platform/`,
        showLastUpdateAuthor: true,
        showLastUpdateTime: true,
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'vtt',
        path: 'vtt',
        routeBasePath: 'vtt',
        sidebarPath: './sidebars-vtt.ts',
        editUrl: `${repositoryUrl}/edit/master/apps/docs/vtt/`,
        showLastUpdateAuthor: true,
        showLastUpdateTime: true,
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'forge',
        path: 'forge',
        routeBasePath: 'forge',
        sidebarPath: './sidebars-forge.ts',
        editUrl: `${repositoryUrl}/edit/master/apps/docs/forge/`,
        showLastUpdateAuthor: true,
        showLastUpdateTime: true,
      },
    ],
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'codex',
        path: 'codex',
        routeBasePath: 'codex',
        sidebarPath: './sidebars-codex.ts',
        editUrl: `${repositoryUrl}/edit/master/apps/docs/codex/`,
        showLastUpdateAuthor: true,
        showLastUpdateTime: true,
      },
    ],
  ],
  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'Nexus Docs',
      logo: {
        alt: 'Nexus documentation',
        src: 'img/logo.svg',
      },
      items: [
        { to: '/platform/', label: 'Platform', position: 'left' },
        { to: '/vtt/', label: 'VTT', position: 'left' },
        { to: '/forge/', label: 'Forge', position: 'left' },
        { to: '/codex/', label: 'Codex', position: 'left' },
        {
          href: repositoryUrl,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Products',
          items: [
            { label: 'VTT', to: '/vtt/' },
            { label: 'Forge', to: '/forge/' },
            { label: 'Codex', to: '/codex/' },
          ],
        },
        {
          title: 'Contributors',
          items: [
            { label: 'Platform', to: '/platform/' },
            { label: 'Repository', href: repositoryUrl },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Nexus contributors.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
