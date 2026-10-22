import type { Metadata } from "next";
import { Empty, Pager } from "../../../components/blocks";
import {
  CtaBand,
  FilterChips,
  PageHero,
  ProjectGrid,
} from "../../../components/catalog";
import { getProjects } from "../../../lib/cms";
import { buildMetadata } from "../../../lib/metadata";
import { paginateProjects, projectFilters } from "../../../lib/project-filter";
import { PROJECT_CTA } from "../../../lib/site";

export const metadata: Metadata = buildMetadata(
  "/du-an",
  "Dự án đang vận hành",
);

type Props = {
  searchParams: Promise<{
    "dich-vu"?: string | string[];
    page?: string | string[];
  }>;
};

export default async function ProjectsPage({ searchParams }: Props) {
  const query = await searchParams;
  const projects = await getProjects();
  const filters = projectFilters(projects);
  const result = paginateProjects(projects, query["dich-vu"], query.page);
  const base = result.active
    ? `/du-an?dich-vu=${encodeURIComponent(result.active)}`
    : "/du-an";
  return (
    <>
      <PageHero
        overline="Dự án"
        title="Dự án đang vận hành"
        lead="Hồ sơ dự án chỉ hiển thị khi BMSL đã duyệt dữ liệu, ảnh và quyền sử dụng."
      />
      <section className="detail-section-flush">
        <div className="container">
          {filters.length ? (
            <FilterChips
              label="Lọc dự án theo dịch vụ"
              items={[
                {
                  key: "all",
                  label: "Tất cả",
                  href: "/du-an",
                  active: !result.active,
                },
                ...filters.map((f) => ({
                  key: f.slug,
                  label: f.name,
                  href: `/du-an?dich-vu=${encodeURIComponent(f.slug)}`,
                  active: result.active === f.slug,
                })),
              ]}
            />
          ) : null}
          {result.items.length ? (
            <ProjectGrid items={result.items} />
          ) : (
            <Empty>Chưa có dự án được công bố.</Empty>
          )}
          <Pager
            base={base}
            page={result.page}
            totalPages={result.totalPages}
          />
        </div>
      </section>
      <CtaBand
        title="Muốn tham quan một dự án đang vận hành?"
        {...PROJECT_CTA}
      />
    </>
  );
}
