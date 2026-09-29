"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { FEEDBACK_FORM_URL, SURVEY_FORM_URL } from "@/lib/appConfig";

/** The public link of a Google Form, turned into the address that can be embedded. */
function embeddedUrl(url: string): string {
  return url.includes("embedded=true") ? url : `${url}${url.includes("?") ? "&" : "?"}embedded=true`;
}

function FormCard({
  title,
  description,
  url,
}: {
  title: string;
  description: string;
  url: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-line p-4">
      <div className="t-node text-fg">{title}</div>
      <p className="mt-1 text-small leading-relaxed text-fg-muted">{description}</p>

      {!url ? (
        <p className="mt-3 font-mono text-small text-fg-faint">em breve</p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="h-8 rounded-lg border border-st-active bg-st-active/10 px-3 text-small text-fg transition-colors hover:bg-st-active/20"
            >
              {open ? "Fechar formulário" : "Responder aqui"}
            </button>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-small text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              Abrir em nova aba
              <ExternalLink size={13} strokeWidth={1.5} />
            </a>
          </div>

          {open && (
            <iframe
              src={embeddedUrl(url)}
              title={title}
              loading="lazy"
              className="mt-4 h-[34rem] w-full rounded-lg border border-line bg-white"
            />
          )}
        </>
      )}
    </div>
  );
}

export default function FeedbackTab() {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="t-node mb-1 text-fg">Sua opinião ajuda o simulador a melhorar</h3>
        <p className="text-small leading-relaxed text-fg-muted">
          Conte o que funcionou, o que confundiu e o que faltou. Dá para mandar uma sugestão
          livre ou responder a uma pesquisa rápida, de poucos minutos.
        </p>
      </div>

      <div className="grid gap-4">
        <FormCard
          title="Sugestões e feedback"
          description="Uma ideia de melhoria, um problema que você encontrou ou um elogio."
          url={FEEDBACK_FORM_URL}
        />
        <FormCard
          title="Pesquisa rápida"
          description="Algumas perguntas sobre como foi usar o simulador e se ele ajudou a entender a CPU."
          url={SURVEY_FORM_URL}
        />
      </div>

      <p className="text-micro leading-snug text-fg-faint">
        Os formulários são do Google Forms: ao abri-los, o Google recebe o que você digitar e os
        dados de acesso da página dele. Nada do seu programa é enviado.
      </p>
    </div>
  );
}
