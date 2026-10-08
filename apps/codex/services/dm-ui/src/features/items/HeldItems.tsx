import { EntityLink } from '@/features/section-shell/EntityLink';
import { useSectionBundle } from '@/features/section-shell/SectionContext';

import { itemsHeldBy } from './itemsModel';
import styles from './HeldItems.module.css';

interface HeldItemsProps {
  /** Id of the NPC, location or encounter that holds the items. */
  holderId: string;
  /** Group heading, e.g. "Loot", "Carries" or "Items here". */
  heading: string;
}

/** Items whose holder is `holderId`, as links; nothing when there are none. */
export function HeldItems({ holderId, heading }: HeldItemsProps) {
  const { bundle } = useSectionBundle();
  const held = itemsHeldBy(bundle, holderId);
  if (held.length === 0) return null;
  return (
    <section aria-label={heading} className={styles.held}>
      <h3>{heading}</h3>
      <ul>
        {held.map((item) => (
          <li key={item.id}>
            <EntityLink id={item.id} />
            {item.quantity > 1 ? (
              <span className={styles.quantity}>x{item.quantity}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
