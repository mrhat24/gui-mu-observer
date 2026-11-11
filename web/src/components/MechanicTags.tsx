import type { Mechanic } from '../domain/waveMechanics';
import styles from '../styles/MechanicTags.module.scss';

const colors: Record<Mechanic, string> = {
  Стан: styles.stun,
  Слип: styles.sleep,
  Рут: styles.root,
  'Сбитие каста': styles.interrupt,
  Несогласие: styles.interrupt,
  'АоЕ-слип': styles.sleep,
  'АоЕ-ДоТ': styles.damage,
  Драконы: styles.damage,
};

export default function MechanicTags({ tags }: { tags: readonly Mechanic[] }) {
  if (!tags.length) return null;
  return (
    <ul className={styles.tags} aria-label="Механики">
      {tags.map((tag) => (
        <li key={tag} className={colors[tag]}>
          {tag}
        </li>
      ))}
    </ul>
  );
}
