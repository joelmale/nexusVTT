import Link from '@docusaurus/Link';
import Heading from '@theme/Heading';
import Layout from '@theme/Layout';
import type { ReactNode } from 'react';

import styles from './index.module.css';

interface DocumentationArea {
  description: string;
  label: string;
  path: string;
}

const documentationAreas: DocumentationArea[] = [
  {
    label: 'Platform',
    description: 'Monorepo-wide architecture, integrations, and policy.',
    path: '/platform/',
  },
  {
    label: 'Nexus VTT',
    description: 'Tabletop features, realtime internals, and operations.',
    path: '/vtt/',
  },
  {
    label: 'Nexus Forge',
    description: 'Character creation, character sheets, and monsters.',
    path: '/forge/',
  },
  {
    label: 'Nexus Codex',
    description: 'Document services, APIs, deployment, and development.',
    path: '/codex/',
  },
];

export default function Home(): ReactNode {
  return (
    <Layout
      title="Documentation"
      description="Contributor documentation for the Nexus monorepo"
    >
      <header className={styles.hero}>
        <div className="container">
          <Heading as="h1">Nexus documentation</Heading>
          <p>
            One source of truth for the platform and its three applications.
          </p>
        </div>
      </header>
      <main className="container">
        <section className={styles.cards} aria-label="Documentation areas">
          {documentationAreas.map((area) => (
            <Link className={styles.card} key={area.path} to={area.path}>
              <Heading as="h2">{area.label}</Heading>
              <p>{area.description}</p>
            </Link>
          ))}
        </section>
      </main>
    </Layout>
  );
}
