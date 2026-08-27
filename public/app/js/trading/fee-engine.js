/* The Capital — Trading fee engine
 * Fees are configurable and separated by SGI / BRVM / DC-BR / VAT.
 * Professional SGI users can explicitly disable SGI brokerage.
 */
(function () {
  'use strict';

  window.TheCapitalTradingFees = {
    defaultMarketFees: {
      brvmRate: 0.002,
      dcbrRate: 0.001,
      vatRate: 0.18
    },

    calculate: function (input) {
      input = input || {};
      var gross = Math.max(0, Number(input.grossAmount) || 0);
      var sgiRate = input.sgiFeesExempt ? 0 : Math.max(0, Number(input.sgiRate) || 0);
      var brvmRate = Math.max(0, Number(input.brvmRate != null ? input.brvmRate : this.defaultMarketFees.brvmRate));
      var dcbrRate = Math.max(0, Number(input.dcbrRate != null ? input.dcbrRate : this.defaultMarketFees.dcbrRate));
      var vatRate = Math.max(0, Number(input.vatRate != null ? input.vatRate : this.defaultMarketFees.vatRate));

      var sgi = gross * sgiRate;
      var brvm = gross * brvmRate;
      var dcbr = gross * dcbrRate;
      var taxableFees = Math.max(0, sgi + brvm + dcbr + (Number(input.otherTaxableFees) || 0));
      var vat = taxableFees * vatRate;
      var otherFees = Math.max(0, Number(input.otherFees) || 0);
      var totalFees = sgi + brvm + dcbr + otherFees + vat;

      return {
        grossAmount: gross,
        sgiFees: sgi,
        brvmFees: brvm,
        dcbrFees: dcbr,
        otherFees: otherFees,
        vat: vat,
        totalFees: totalFees,
        netBuyCost: gross + totalFees,
        netSellProceeds: Math.max(0, gross - totalFees),
        sgiFeesExempt: !!input.sgiFeesExempt
      };
    },

    position: function (input) {
      input = input || {};
      var quantity = Math.max(0, Number(input.quantity) || 0);
      var entry = Math.max(0, Number(input.entryPrice) || 0);
      var target = Math.max(0, Number(input.targetPrice) || 0);
      var stop = Math.max(0, Number(input.stopPrice) || 0);
      var buy = this.calculate({ grossAmount: quantity * entry, sgiRate: input.sgiRate, sgiFeesExempt: input.sgiFeesExempt, brvmRate: input.brvmRate, dcbrRate: input.dcbrRate, vatRate: input.vatRate });
      var sellTarget = this.calculate({ grossAmount: quantity * target, sgiRate: input.sgiRate, sgiFeesExempt: input.sgiFeesExempt, brvmRate: input.brvmRate, dcbrRate: input.dcbrRate, vatRate: input.vatRate });
      var sellStop = this.calculate({ grossAmount: quantity * stop, sgiRate: input.sgiRate, sgiFeesExempt: input.sgiFeesExempt, brvmRate: input.brvmRate, dcbrRate: input.dcbrRate, vatRate: input.vatRate });
      var gain = sellTarget.netSellProceeds - buy.netBuyCost;
      var loss = sellStop.netSellProceeds - buy.netBuyCost;
      var roi = buy.netBuyCost ? gain / buy.netBuyCost : 0;
      var risk = Math.abs(loss);
      var rr = risk ? gain / risk : null;

      return { buy: buy, target: sellTarget, stop: sellStop, netGain: gain, netLoss: loss, roi: roi, riskReward: rr };
    }
  };
})();
