import type { Resume, Location, Link } from "../types";

export function SafeLink({ link }: { link: Link }) {
  if (!/^(https?:\/\/|mailto:|tel:)/i.test(link.url))
    return <span>{link.label}</span>;
  const external = /^https?:/i.test(link.url);
  return (
    <a
      href={link.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
    >
      {link.label}
      {external && <span aria-hidden="true"> ↗</span>}
    </a>
  );
}

export function LocationContent({
  resume,
  location,
  unlockedIds,
  exploration = false,
}: {
  resume: Resume;
  location: Location;
  unlockedIds?: string[];
  exploration?: boolean;
}) {
  if (location.sectionId === "__about")
    return (
      <div className="profile-content">
        <span className="eyebrow">THE PERSON BEHIND THE VILLAGE</span>
        <h2>{resume.name}</h2>
        <p className="profile-summary">{resume.summary}</p>
        {resume.contact.location && (
          <p className="muted">Based in {resume.contact.location}</p>
        )}
        <div className="link-row">
          {resume.links.map((link, i) => (
            <SafeLink key={i} link={link} />
          ))}
        </div>
      </div>
    );
  if (location.sectionId === "__contact")
    return (
      <div className="profile-content">
        <span className="eyebrow">KEEP IN TOUCH</span>
        <h2>Let’s connect.</h2>
        {resume.contact.email && (
          <p>
            <a href={`mailto:${resume.contact.email}`}>
              {resume.contact.email}
            </a>
          </p>
        )}
        {resume.contact.phone && (
          <p>
            <a href={`tel:${resume.contact.phone.replace(/[^+\d]/g, "")}`}>
              {resume.contact.phone}
            </a>
          </p>
        )}
        {resume.contact.location && <p>{resume.contact.location}</p>}
        <div className="link-row">
          {resume.links.map((link, i) => (
            <SafeLink key={i} link={link} />
          ))}
        </div>
        <a className="button primary" href="./resume.pdf" download>
          Download original résumé ↓
        </a>
      </div>
    );
  const section = resume.sections.find((s) => s.id === location.sectionId);
  return (
    <div>
      <span className="eyebrow">
        FIELD NOTES · {String(location.vertex).padStart(2, "0")}
      </span>
      <h2>{section?.label || location.label}</h2>
      {section?.entries.map((entry) => {
        const locked = exploration && !unlockedIds?.includes(entry.id);
        return (
          <article
            className={`entry ${locked ? "locked-entry" : ""}`}
            key={entry.id}
          >
            <h3>{entry.title}</h3>
            {locked ? (
              <p className="lock-hint">
                Undiscovered field note. Enter {location.label} and use the
                related book, desk, or display to reveal this entry.
              </p>
            ) : (
              <>
                {(entry.dates || entry.subtitle) && (
                  <p className="entry-meta">
                    {[entry.subtitle, entry.dates].filter(Boolean).join(" · ")}
                  </p>
                )}
                {entry.details?.length > 0 && (
                  <ul>
                    {entry.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                )}
                {entry.links && (
                  <div className="link-row">
                    {entry.links.map((link, i) => (
                      <SafeLink key={i} link={link} />
                    ))}
                  </div>
                )}
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
