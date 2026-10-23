import { getPage } from '../lib/cms';
import { Img, Overline } from './blocks';

/** Optional About blocks (history, team, capabilities, values). Each renders only when it holds confirmed items. */
export async function AboutSections() {
  const page = await getPage('about-page');
  if (!page) return null;
  const { history, team, capabilities, values } = page;
  return (
    <>
      {history.length ? (
        <section className="pg-section white" id="lich-su" aria-labelledby="about-history">
          <div className="container">
            <Overline>LỊCH SỬ</Overline>
            <h2 className="pg-title" id="about-history">
              Lịch sử hình thành
            </h2>
            <ol className="about-list">
              {history.map((h, i) => (
                <li key={`${i}-${h.year}`}>
                  <p className="about-list-key">{h.year}</p>
                  <h3>{h.title}</h3>
                  {h.description ? <p>{h.description}</p> : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      ) : null}
      {team.length ? (
        <section className="pg-section pale" id="doi-ngu" aria-labelledby="about-team">
          <div className="container">
            <Overline>ĐỘI NGŨ</Overline>
            <h2 className="pg-title" id="about-team">
              Đội ngũ
            </h2>
            <ul className="about-list about-team">
              {team.map((m, i) => (
                <li key={`${i}-${m.name}`}>
                  {m.photo ? <Img image={m.photo} sizes="(min-width: 64rem) 20vw, 50vw" /> : null}
                  <h3>{m.name}</h3>
                  {m.role ? <p>{m.role}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {capabilities.length ? (
        <section className="pg-section white" id="nang-luc" aria-labelledby="about-capabilities">
          <div className="container">
            <Overline>NĂNG LỰC</Overline>
            <h2 className="pg-title" id="about-capabilities">
              Năng lực và giấy phép
            </h2>
            <ul className="about-list">
              {capabilities.map((c, i) => (
                <li key={`${i}-${c.name}`}>
                  <h3>{c.name}</h3>
                  {c.issuer ? <p>Đơn vị cấp: {c.issuer}</p> : null}
                  {c.validity ? <p>Hiệu lực: {c.validity}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
      {values.length ? (
        <section className="pg-section pale" id="van-hoa" aria-labelledby="about-values">
          <div className="container">
            <Overline>VĂN HOÁ</Overline>
            <h2 className="pg-title" id="about-values">
              Văn hoá và giá trị
            </h2>
            <ul className="about-list">
              {values.map((v, i) => (
                <li key={`${i}-${v.title}`}>
                  <h3>{v.title}</h3>
                  {v.description ? <p>{v.description}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
