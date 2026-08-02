'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NPSScoreProps {
  score: number;
  promoters: number;
  passives: number;
  detractors: number;
}

export function NPSScore({ score, promoters, passives, detractors }: NPSScoreProps) {
  const total = promoters + passives + detractors;
  // Sem nenhuma resposta o percentual seria 0/0 = NaN, que vaza para o
  // `width: NaN%` das barras e para o texto. Antes não aparecia porque os
  // números vinham fixos do código; agora vêm do banco e podem ser zero.
  const share = (part: number) => (total > 0 ? (part / total) * 100 : 0);
  const promotersPercentage = share(promoters);
  const passivesPercentage = share(passives);
  const detractorsPercentage = share(detractors);

  // Mesmo par de tons do detalhamento abaixo. Como número de 36px ele passaria
  // no limite de texto grande (3:1) mesmo no tom 600, mas manter duas escalas
  // diferentes para a mesma informação é o tipo de coisa que volta a quebrar.
  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-700 dark:text-green-400";
    if (score >= 50) return "text-yellow-700 dark:text-yellow-400";
    return "text-red-700 dark:text-red-400";
  };

  return (
    <Card className="bg-card text-card-foreground border shadow-md">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          NPS (Net Promoter Score)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="text-center">
            <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
              {score}
            </span>
          </div>
          
          <div className="flex h-4 rounded-full overflow-hidden">
            <div
              className="bg-green-500"
              style={{ width: `${promotersPercentage}%` }}
            />
            <div
              className="bg-yellow-500"
              style={{ width: `${passivesPercentage}%` }}
            />
            <div
              className="bg-red-500"
              style={{ width: `${detractorsPercentage}%` }}
            />
          </div>

          {/* Um tom por tema: o 600 reprovava no claro (verde 3,3:1, amarelo
              2,94:1) e no escuro (vermelho 3,19:1). As barras acima não mudam —
              ali a cor é bloco, não texto, e não precisa passar em contraste. */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-green-700 dark:text-green-400 font-medium">{Math.round(promotersPercentage)}%</p>
              <p className="text-muted-foreground">Promotores</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-700 dark:text-yellow-400 font-medium">{Math.round(passivesPercentage)}%</p>
              <p className="text-muted-foreground">Neutros</p>
            </div>
            <div className="text-center">
              <p className="text-red-700 dark:text-red-400 font-medium">{Math.round(detractorsPercentage)}%</p>
              <p className="text-muted-foreground">Detratores</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
