<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SendLocalPlayActionRequest extends FormRequest
{
    public const TYPES = ['MARK', 'UNDO_MARK', 'ROTATE', 'END_TURN', 'RESET'];

    public const MAX_FIELDS = 6;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'action' => ['required', 'array', 'max:'.self::MAX_FIELDS],
            'action.type' => ['required', 'string', Rule::in(self::TYPES)],
            'action.*' => [
                function (string $attribute, mixed $value, Closure $fail): void {
                    $isShortString = is_string($value) && strlen($value) <= 16;
                    if (! is_int($value) && ! $isShortString) {
                        $fail('Action fields must be whole numbers or short strings.');
                    }
                },
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'action.required' => 'No action was sent.',
            'action.max' => 'The action has too many fields.',
            'action.type.in' => 'Action type must be one of: '.implode(', ', self::TYPES),
        ];
    }
}
