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
  const promotersPercentage = (promoters / total) * 100;
  const passivesPercentage = (passives / total) * 100;
  const detractorsPercentage = (detractors / total) * 100;

  const getScoreColor = (score: number) => {
    if (score >= 75) return "text-green-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
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

          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <p className="text-green-600 font-medium">{Math.round(promotersPercentage)}%</p>
              <p className="text-muted-foreground">Promotores</p>
            </div>
            <div className="text-center">
              <p className="text-yellow-600 font-medium">{Math.round(passivesPercentage)}%</p>
              <p className="text-muted-foreground">Neutros</p>
            </div>
            <div className="text-center">
              <p className="text-red-600 font-medium">{Math.round(detractorsPercentage)}%</p>
              <p className="text-muted-foreground">Detratores</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
