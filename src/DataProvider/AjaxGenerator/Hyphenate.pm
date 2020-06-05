package Hyphenate;

use strict;
use utf8;

use constant HYPHEN => "\x{AD}"; #visible in, e.g., Komodo Edit.

my ($hyphenPatterns, $hyphenRegexPattern, $soglasnie, $glasnie, $znaki, $RgxSoglasnie, $RgxGlasnie, $RgxZnaki, $RgxNonChar);

$hyphenPatterns = {
	GSS => 'GS' . &HYPHEN . 'S',
	SGSG => 'SG' . &HYPHEN . 'SG',
	SQS => 'SQ' . &HYPHEN . 'S',
	GG => 'G' . &HYPHEN . 'G',
	SS => 'S' . &HYPHEN . 'S'
};
$hyphenRegexPattern = join "|",keys %{$hyphenPatterns};
$hyphenRegexPattern = qr/(.*)($hyphenRegexPattern){1}(.*)/o;

$soglasnie = "bcdfghjklmnpqrstvwxzбвгджзйклмнпрстфхцчшщ";
$glasnie = "aeiouyАОУЮИЫЕЭЯЁєіїў";
$znaki = "ъь";

$RgxSoglasnie = qr/[$soglasnie]/oi;
$RgxGlasnie = qr/[$glasnie]/oi;
$RgxZnaki = qr/[$znaki]/oi;
$RgxNonChar = qr/([^$soglasnie$glasnie$znaki]+)/oi; #в скобках, чтобы оно возвращалось при сплите.

sub HyphString {
	use utf8;
	my $word = shift;

	my @wordArrayWithUnknownSymbols = split $RgxNonChar , $word; #собрали все слова и неизвестные символы. Для слова "пример!№?;слова" будет содержать "пример", "!№?;", "слова".

	for my $word (@wordArrayWithUnknownSymbols) {
		next if $word =~ $RgxNonChar;
		$word = HyphParticularWord($word);
	}
	return join "", @wordArrayWithUnknownSymbols;
}

sub HyphParticularWord {
	use utf8;
	my $word = shift;
	my $softHyphMinPart = 2;

	return $word if ( length($word) < 2 * $softHyphMinPart + 1 || $word eq uc($word));
	my $wordCopy = $word; #чтобы сохранить оригинальное слово. А $word заменим структурным эквивалентном
	$word =~ s/$RgxSoglasnie/S/g;
	$word =~ s/$RgxGlasnie/G/g;
	$word =~ s/$RgxZnaki/Q/g;
	while ($word =~ s/$hyphenRegexPattern/Hyphenate($1,$2,$3,\$wordCopy,$softHyphMinPart)/ge) {}
	return $wordCopy;
}

sub Hyphenate {
	use utf8;
	my ($leftFromPattern,$pattern,$rightFromPattern,$wordCopyRef,$softHyphMinPart) = @_;
	my $leftOffsetOfCurrentHyphen = length($leftFromPattern) + index($hyphenPatterns->{$pattern},&HYPHEN);
	my $rightOffsetOfCurrentHyphen = length(${$wordCopyRef}) - $leftOffsetOfCurrentHyphen; #слева дефисы не добавляются. Они добавляются справа

	substr(${$wordCopyRef}, 0, $leftOffsetOfCurrentHyphen) .= &HYPHEN
		if ($leftOffsetOfCurrentHyphen >= $softHyphMinPart && $rightOffsetOfCurrentHyphen >= $softHyphMinPart);
	#переносы ставим только если остается у нас в конце и в начале по softHyphMinPart символов

	return $leftFromPattern . $hyphenPatterns->{$pattern} . $rightFromPattern; #новую структуру кидаем в структурный эквивалент
}

1;