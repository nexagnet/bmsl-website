import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Crumbs, Img } from "../../../../components/blocks";
import {
  CtaBand,
  PageHero,
  SectionHeading,
} from "../../../../components/catalog";
import { JsonLd } from "../../../../components/JsonLd";
import { getProject } from "../../../../lib/cms";
import { buildMetadata } from "../../../../lib/metadata";
import { getSiteUrl, PROJECT_CTA } from "../../../../lib/site";
import { breadcrumbLd } from "../../../../lib/structured-data";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  return project
    ? buildMetadata(project.href, project.name, project.seo, project.summary)
    : {};
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();
  const [cover, ...album] = project.images;
  const rows = [
    ...project.facts,
    ...(project.bqtFeedback
      ? [{ label: "Phản hồi BQT", value: project.bqtFeedback }]
      : []),
  ];
  return (
    <>
      <Crumbs
        items={[{ label: "Dự án", href: "/du-an" }, { label: project.name }]}
      />
      <JsonLd
        data={breadcrumbLd(getSiteUrl(), [
          { name: "Dự án", path: "/du-an" },
          { name: project.name, path: project.href },
        ])}
      />
      <article>
        <PageHero
          overline={project.services.map((s) => s.name).join(" · ") || "Dự án"}
          title={project.name}
          lead={project.summary}
        />
        {cover || rows.length || project.services.length ? (
          <section className="detail-section-flush">
            <div className="container">
              {cover ? (
                <div className="project-cover">
                  <Img
                    image={cover}
                    sizes="(min-width: 80rem) 1312px, 100vw"
                    eager
                  />
                </div>
              ) : null}
              {rows.length || project.services.length ? (
                <div className="project-detail-row">
                  {rows.length ? (
                    <dl className="meta-table">
                      {rows.map((r) => (
                        <div key={r.label}>
                          <dt>{r.label}</dt>
                          <dd>{r.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {project.services.length ? (
                    <div>
                      <h2 className="subtitle">Dịch vụ áp dụng</h2>
                      <ul className="plain-list">
                        {project.services.map((s) => (
                          <li key={s.href}>
                            <Link className="text-link" href={s.href}>
                              {s.name} →
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
        {album.length ? (
          <section className="detail-section">
            <div className="container">
              <SectionHeading overline="Album" title="Hình ảnh dự án" />
              <ul className="album-grid">
                {album.map((image) => (
                  <li key={image.id}>
                    <Img
                      image={image}
                      sizes="(min-width: 64rem) 33vw, (min-width: 48rem) 50vw, 100vw"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}
      </article>
      <CtaBand title="Đăng ký tham quan dự án" {...PROJECT_CTA} />
    </>
  );
}
